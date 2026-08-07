import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { AccountEntity } from '../accounting/entities/account.entity';
import { FiscalYearEntity } from '../accounting/entities/fiscal-year.entity';
import { JournalEntryEntity } from '../accounting/entities/journal-entry.entity';
import { PartyEntity } from '../accounting/entities/party.entity';
import { TaxCodeEntity } from '../accounting/entities/tax-code.entity';
import type { SystemPurpose } from '../accounting/accounting.constants';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { JournalService } from '../accounting/journal.service';
import { AuditService } from '../audit/audit.service';
import { InventoryLocationEntity } from '../inventory/entities/inventory-location.entity';
import { InventoryService } from '../inventory/inventory.service';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { PlanLimitService } from '../subscription/plan-limits/plan-limit.service';
import { BranchEntity } from '../tenancy/entities/branch.entity';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { UomEntity } from '../trading/entities/uom.entity';
import {
  CreatePurchaseBillDto,
  PostPurchaseBillDto,
  PurchaseBillLineDto,
  PurchaseBillQueryDto,
  UpdatePurchaseBillDto,
} from './dto/purchase-bill.dto';
import { PurchaseBillLineEntity } from './entities/purchase-bill-line.entity';
import { PurchaseBillEntity } from './entities/purchase-bill.entity';
import { PurchaseReceiptLineEntity } from './entities/purchase-receipt-line.entity';
import {
  PURCHASE_AUDIT_ACTIONS,
  PURCHASE_BILL_DOCUMENT_TYPE,
  PURCHASE_BILL_NUMBER_PREFIX,
} from './purchase.constants';
import {
  PurchaseBillAccountMissingException,
  PurchaseBillDirectLineIncompleteException,
  PurchaseBillFiscalYearMissingException,
  PurchaseBillItemNotFoundException,
  PurchaseBillItemNotTrackedException,
  PurchaseBillLocationNotFoundException,
  PurchaseBillNotDraftException,
  PurchaseBillNotFoundException,
  PurchaseBillReceiptLineAlreadyBilledException,
  PurchaseBillReceiptLineNoRemainingException,
  PurchaseBillReceiptLineNotFoundException,
  PurchaseBillReceiptLinePartialException,
  PurchaseBillReceiptLocationMismatchException,
  PurchaseBillReceiptNotPostedException,
  PurchaseBillReceiptSupplierMismatchException,
  PurchaseBillSupplierNotFoundException,
  PurchaseBillTdsCodeInvalidException,
  PurchaseBillTdsWithholdingException,
  PurchaseBillUomConversionNotFoundException,
  PurchaseBillUomNotFoundException,
  PurchaseBillZeroQuantityException,
} from './purchase.errors';

const ROUND2 = (n: number): number => Math.round(n * 100) / 100;
const ROUND3 = (n: number): number => Math.round(n * 1000) / 1000;

interface PreparedBillLine {
  lineNo: number;
  sourcePurchaseReceiptLineId: string | null;
  itemId: string;
  uomId: string;
  quantity: number;
  baseQuantity: number;
  unitPrice: number;
  grossAmount: number;
  discountShare: number;
  taxCodeId: string | null;
  irdCategory: string | null;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
  tdsTaxCodeId: string | null;
  tdsRate: number;
  tdsAmount: number;
  lineTotal: number;
}

interface PreparedBill {
  lines: PreparedBillLine[];
  billedGross: number;
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  nonTaxableTotal: number;
  taxTotal: number;
  tdsTotal: number;
  total: number;
}

@Injectable()
export class PurchaseBillService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(PurchaseBillEntity)
    private readonly billRepo: Repository<PurchaseBillEntity>,
    private readonly audit: AuditService,
    private readonly documentSequenceService: DocumentSequenceService,
    private readonly journalService: JournalService,
    private readonly inventoryService: InventoryService,
    private readonly planLimitService: PlanLimitService,
    private readonly nepaliDate: NepaliDateConverter,
  ) {}

  // ---- Mutations ----------------------------------------------------------

  async create(
    organizationId: string,
    actorId: string,
    dto: CreatePurchaseBillDto,
  ): Promise<PurchaseBillEntity> {
    return this.dataSource.transaction(async (manager) => {
      const supplier = await this.requireSupplier(
        manager,
        organizationId,
        dto.partyId,
      );
      const prepared = await this.prepareBill(
        manager,
        organizationId,
        supplier.id,
        dto.lines,
        dto.discountAmount,
      );

      const billRepo = manager.getRepository(PurchaseBillEntity);
      const bill = await billRepo.save(
        billRepo.create({
          organizationId,
          branchId: dto.branchId ?? null,
          billNumber: null,
          vendorBillNo: dto.vendorBillNo ?? null,
          partyId: supplier.id,
          status: 'DRAFT',
          inventoryLocationId: null,
          taxableTotal: prepared.taxableTotal.toFixed(2),
          nonTaxableTotal: prepared.nonTaxableTotal.toFixed(2),
          subtotal: prepared.subtotal.toFixed(2),
          discountTotal: prepared.discountTotal.toFixed(2),
          taxTotal: prepared.taxTotal.toFixed(2),
          tdsTotal: prepared.tdsTotal.toFixed(2),
          total: prepared.total.toFixed(2),
          paidAmount: '0.00',
          balanceAmount: ROUND2(prepared.total - prepared.tdsTotal).toFixed(2),
          notes: dto.notes ?? null,
        }),
      );

      await this.saveLines(manager, organizationId, bill.id, prepared.lines);

      await this.audit.record(
        {
          organizationId,
          branchId: bill.branchId,
          userId: actorId,
          action: PURCHASE_AUDIT_ACTIONS.BILL_CREATE,
          entityType: 'purchase_bill',
          entityId: bill.id,
          newData: {
            status: 'DRAFT',
            partyId: supplier.id,
            total: prepared.total.toFixed(2),
            tdsTotal: prepared.tdsTotal.toFixed(2),
            lineCount: prepared.lines.length,
          },
        },
        manager,
      );

      return this.buildBillView(manager, organizationId, bill.id);
    });
  }

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdatePurchaseBillDto,
  ): Promise<PurchaseBillEntity> {
    return this.dataSource.transaction(async (manager) => {
      const bill = await this.requireBill(manager, organizationId, id);
      if (bill.status !== 'DRAFT') {
        throw new PurchaseBillNotDraftException(id, bill.status, 'update');
      }

      if (dto.partyId !== undefined && dto.partyId !== bill.partyId) {
        const supplier = await this.requireSupplier(
          manager,
          organizationId,
          dto.partyId,
        );
        bill.partyId = supplier.id;
      }
      if (dto.branchId !== undefined) bill.branchId = dto.branchId;
      if (dto.vendorBillNo !== undefined) bill.vendorBillNo = dto.vendorBillNo;
      if (dto.notes !== undefined) bill.notes = dto.notes;

      const effectiveLines =
        dto.lines ?? (await this.toLineDtos(manager, bill));
      const prepared = await this.prepareBill(
        manager,
        organizationId,
        bill.partyId,
        effectiveLines,
        dto.discountAmount ?? Number(bill.discountTotal),
      );

      bill.taxableTotal = prepared.taxableTotal.toFixed(2);
      bill.nonTaxableTotal = prepared.nonTaxableTotal.toFixed(2);
      bill.subtotal = prepared.subtotal.toFixed(2);
      bill.discountTotal = prepared.discountTotal.toFixed(2);
      bill.taxTotal = prepared.taxTotal.toFixed(2);
      bill.tdsTotal = prepared.tdsTotal.toFixed(2);
      bill.total = prepared.total.toFixed(2);
      bill.balanceAmount = ROUND2(prepared.total - prepared.tdsTotal).toFixed(
        2,
      );

      const lineRepo = manager.getRepository(PurchaseBillLineEntity);
      await lineRepo.delete({ billId: bill.id });
      await this.saveLines(manager, organizationId, bill.id, prepared.lines);
      await manager.getRepository(PurchaseBillEntity).save(bill);

      await this.audit.record(
        {
          organizationId,
          branchId: bill.branchId,
          userId: actorId,
          action: PURCHASE_AUDIT_ACTIONS.BILL_UPDATE,
          entityType: 'purchase_bill',
          entityId: bill.id,
          newData: {
            status: 'DRAFT',
            partyId: bill.partyId,
            total: bill.total,
            discountTotal: bill.discountTotal,
            lineCount: prepared.lines.length,
          },
        },
        manager,
      );

      return this.buildBillView(manager, organizationId, bill.id);
    });
  }

  /**
   * Posts a draft: reserves the `BILL-` number, posts the Inventory/VAT/TDS/AP
   * journal, reweights moving-average cost (and stocks in direct lines),
   * stamps sourced receipt lines as billed, and consumes the monthly
   * `purchase_bills_per_month` quota — all in one transaction.
   */
  async post(
    organizationId: string,
    actorId: string,
    id: string,
    dto: PostPurchaseBillDto,
  ): Promise<PurchaseBillEntity> {
    const postedId = await this.dataSource.transaction(async (manager) => {
      const bill = await this.requireBill(manager, organizationId, id);
      if (bill.status !== 'DRAFT') {
        throw new PurchaseBillNotDraftException(id, bill.status, 'post');
      }
      await this.assertSupplierActive(manager, organizationId, bill.partyId);
      await this.requireLocation(
        manager,
        organizationId,
        dto.inventoryLocationId,
      );

      const lines = await manager.getRepository(PurchaseBillLineEntity).find({
        where: { billId: bill.id },
        order: { lineNo: 'ASC' },
      });

      // Re-validate the single-move invariants against the live GRN lines
      // (locked FOR UPDATE so two concurrent bills can never claim the same
      // receipt line) and accumulate the billed-quantity stamps.
      const billedStamps: Array<{
        receiptLine: PurchaseReceiptLineEntity;
        baseQuantity: number;
      }> = [];
      for (const line of lines) {
        if (Number(line.baseQuantity) <= 0) {
          throw new PurchaseBillZeroQuantityException();
        }
        if (!line.sourcePurchaseReceiptLineId) continue;
        const receiptLine = await this.lockReceiptLine(
          manager,
          organizationId,
          line.sourcePurchaseReceiptLineId,
        );
        if (receiptLine.receipt.status !== 'POSTED') {
          throw new PurchaseBillReceiptNotPostedException(
            receiptLine.receiptId,
          );
        }
        if (receiptLine.receipt.partyId !== bill.partyId) {
          throw new PurchaseBillReceiptSupplierMismatchException(
            receiptLine.id,
          );
        }
        if (
          receiptLine.receipt.inventoryLocationId !== dto.inventoryLocationId
        ) {
          throw new PurchaseBillReceiptLocationMismatchException(
            receiptLine.id,
            receiptLine.receipt.inventoryLocationId,
          );
        }
        if (Number(receiptLine.billedQuantity) > 0) {
          throw new PurchaseBillReceiptLineAlreadyBilledException(
            receiptLine.id,
          );
        }
        const remaining = ROUND3(
          Number(receiptLine.baseQuantity) -
            Number(receiptLine.returnedQuantity),
        );
        if (remaining <= 0) {
          throw new PurchaseBillReceiptLineNoRemainingException(receiptLine.id);
        }
        if (ROUND3(Number(line.baseQuantity)) !== remaining) {
          throw new PurchaseBillReceiptLinePartialException(receiptLine.id);
        }
        billedStamps.push({
          receiptLine,
          baseQuantity: Number(line.baseQuantity),
        });
      }

      const today = new Date();
      const todayBs = this.toBs(today);
      const fiscalYear = await this.resolveFiscalYear(
        manager,
        organizationId,
        today,
      );

      const billNumber = await this.documentSequenceService.nextNumber(
        {
          organizationId,
          branchId: bill.branchId,
          fiscalYearId: fiscalYear.id,
          documentType: PURCHASE_BILL_DOCUMENT_TYPE,
          prefix: PURCHASE_BILL_NUMBER_PREFIX,
        },
        manager,
      );

      const journalBranchId =
        bill.branchId ??
        (await this.requireDefaultBranch(manager, organizationId));
      const journal = await this.journalFor(manager, organizationId, bill);
      const entry = await this.journalService.createDraftIn(
        manager,
        organizationId,
        {
          branchId: journalBranchId,
          entryDate: today.toISOString().slice(0, 10),
          description: `Purchase bill ${billNumber}`,
          lines: journal,
        },
        actorId,
      );
      await this.journalService.postIn(
        manager,
        organizationId,
        entry.id,
        actorId,
      );
      // Retry idempotency: a re-run of this POST can never mint a second
      // journal for the same bill (uq_journal_entries_source).
      await manager.getRepository(JournalEntryEntity).update(entry.id, {
        sourceType: 'purchase_bill',
        sourceId: bill.id,
      });

      const inventoryTxn = await this.inventoryService.receiveForPurchaseBill(
        manager,
        organizationId,
        {
          locationId: dto.inventoryLocationId,
          billId: bill.id,
          notes: `Purchase bill ${billNumber}`,
          lines: lines.map((line) => ({
            itemId: line.itemId,
            uomId: line.uomId,
            baseQuantity: Number(line.baseQuantity),
            value: Number(line.grossAmount),
            stockIn: line.sourcePurchaseReceiptLineId === null,
          })),
        },
        actorId,
      );

      const receiptLineRepo = manager.getRepository(PurchaseReceiptLineEntity);
      for (const stamp of billedStamps) {
        await receiptLineRepo.update(
          { id: stamp.receiptLine.id },
          { billedQuantity: stamp.baseQuantity.toFixed(3) },
        );
      }

      await this.planLimitService.consumePeriodic(
        organizationId,
        'purchase_bills_per_month',
        manager,
      );

      bill.status = 'POSTED';
      bill.billNumber = billNumber;
      bill.billDate = today.toISOString().slice(0, 10);
      bill.billDateBs = todayBs;
      bill.fiscalYearId = fiscalYear.id;
      bill.inventoryLocationId = dto.inventoryLocationId;
      bill.journalEntryId = entry.id;
      bill.inventoryTransactionId = inventoryTxn?.id ?? null;
      await manager.getRepository(PurchaseBillEntity).save(bill);

      await this.audit.record(
        {
          organizationId,
          branchId: bill.branchId,
          userId: actorId,
          action: PURCHASE_AUDIT_ACTIONS.BILL_POST,
          entityType: 'purchase_bill',
          entityId: bill.id,
          newData: {
            billNumber,
            status: 'POSTED',
            journalEntryId: entry.id,
            inventoryTransactionId: inventoryTxn?.id ?? null,
            locationId: dto.inventoryLocationId,
            total: bill.total,
            tdsTotal: bill.tdsTotal,
            lineCount: lines.length,
          },
        },
        manager,
      );

      return bill.id;
    });

    return this.get(organizationId, postedId);
  }

  async voidBill(
    organizationId: string,
    actorId: string,
    id: string,
  ): Promise<PurchaseBillEntity> {
    return this.dataSource.transaction(async (manager) => {
      const bill = await this.requireBill(manager, organizationId, id);
      if (bill.status !== 'DRAFT') {
        throw new PurchaseBillNotDraftException(id, bill.status, 'void');
      }

      bill.status = 'CANCELLED';
      await manager.getRepository(PurchaseBillEntity).save(bill);
      await this.audit.record(
        {
          organizationId,
          branchId: bill.branchId,
          userId: actorId,
          action: PURCHASE_AUDIT_ACTIONS.BILL_VOID,
          entityType: 'purchase_bill',
          entityId: bill.id,
          newData: { status: 'CANCELLED' },
        },
        manager,
      );

      return this.buildBillView(manager, organizationId, bill.id);
    });
  }

  // ---- Reads --------------------------------------------------------------

  async get(organizationId: string, id: string): Promise<PurchaseBillEntity> {
    return this.buildBillView(this.dataSource.manager, organizationId, id);
  }

  async list(
    organizationId: string,
    query: PurchaseBillQueryDto,
  ): Promise<[PurchaseBillEntity[], number]> {
    const qb = this.billRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.party', 'party')
      .leftJoinAndSelect('b.inventoryLocation', 'inventoryLocation')
      .where('b.organization_id = :organizationId', { organizationId });

    if (query.status)
      qb.andWhere('b.status = :status', { status: query.status });
    if (query.partyId)
      qb.andWhere('b.party_id = :partyId', { partyId: query.partyId });

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('b.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getMany();
    return [rows, total];
  }

  // ---- Preparation --------------------------------------------------------

  private async prepareBill(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
    lines: PurchaseBillLineDto[],
    headerDiscount: number | undefined,
  ): Promise<PreparedBill> {
    const prepared: PreparedBillLine[] = [];
    for (const [index, dtoLine] of lines.entries()) {
      if (dtoLine.sourcePurchaseReceiptLineId) {
        prepared.push(
          await this.prepareSourcedLine(
            manager,
            organizationId,
            partyId,
            index + 1,
            dtoLine,
          ),
        );
      } else {
        prepared.push(
          await this.prepareDirectLine(
            manager,
            organizationId,
            index + 1,
            dtoLine,
          ),
        );
      }
    }

    const billedGross = ROUND2(
      prepared.reduce((sum, line) => sum + line.grossAmount, 0),
    );
    const discountTotal = ROUND2(
      Math.min(billedGross, Math.max(0, headerDiscount ?? 0)),
    );
    const subtotal = ROUND2(billedGross - discountTotal);

    let taxableTotal = 0;
    let nonTaxableTotal = 0;
    let taxTotal = 0;
    let tdsTotal = 0;
    for (const line of prepared) {
      line.discountShare =
        billedGross > 0
          ? ROUND2((line.grossAmount / billedGross) * discountTotal)
          : 0;
      const taxableBase = ROUND2(line.grossAmount - line.discountShare);
      const isTaxable = line.taxRate > 0;
      line.taxableAmount = isTaxable ? taxableBase : 0;
      line.taxAmount = isTaxable
        ? ROUND2(taxableBase * (line.taxRate / 100))
        : 0;
      line.tdsAmount = ROUND2(line.taxableAmount * (line.tdsRate / 100));
      line.lineTotal = ROUND2(taxableBase + line.taxAmount);
      if (isTaxable) taxableTotal += line.taxableAmount;
      else nonTaxableTotal += taxableBase;
      taxTotal += line.taxAmount;
      tdsTotal += line.tdsAmount;
    }
    taxableTotal = ROUND2(taxableTotal);
    nonTaxableTotal = ROUND2(nonTaxableTotal);
    taxTotal = ROUND2(taxTotal);
    tdsTotal = ROUND2(tdsTotal);
    const total = ROUND2(subtotal + taxTotal);

    return {
      lines: prepared,
      billedGross,
      subtotal,
      discountTotal,
      taxableTotal,
      nonTaxableTotal,
      taxTotal,
      tdsTotal,
      total,
    };
  }

  /**
   * Journal-only flavor (decision 40): the goods already landed on the posted
   * GRN, so the bill only recognizes value. The receipt line must be posted,
   * belong to the same supplier, and never have been billed before; it bills
   * once — exactly the remaining quantity `base − billed − returned`
   * (single-move rule, decision 41).
   */
  private async prepareSourcedLine(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
    lineNo: number,
    dtoLine: PurchaseBillLineDto,
  ): Promise<PreparedBillLine> {
    const receiptLine = await manager
      .getRepository(PurchaseReceiptLineEntity)
      .findOne({
        where: { id: dtoLine.sourcePurchaseReceiptLineId, organizationId },
        relations: { receipt: true },
      });
    if (!receiptLine)
      throw new PurchaseBillReceiptLineNotFoundException(
        dtoLine.sourcePurchaseReceiptLineId!,
      );
    if (receiptLine.receipt.status !== 'POSTED') {
      throw new PurchaseBillReceiptNotPostedException(receiptLine.receiptId);
    }
    if (receiptLine.receipt.partyId !== partyId) {
      throw new PurchaseBillReceiptSupplierMismatchException(receiptLine.id);
    }
    if (Number(receiptLine.billedQuantity) > 0) {
      throw new PurchaseBillReceiptLineAlreadyBilledException(receiptLine.id);
    }
    const remaining = ROUND3(
      Number(receiptLine.baseQuantity) - Number(receiptLine.returnedQuantity),
    );
    if (remaining <= 0) {
      throw new PurchaseBillReceiptLineNoRemainingException(receiptLine.id);
    }
    const remainingEntry = ROUND3(
      Number(receiptLine.quantity) *
        (remaining / Number(receiptLine.baseQuantity)),
    );
    const quantity = dtoLine.quantity ?? remainingEntry;
    if (quantity <= 0) throw new PurchaseBillZeroQuantityException();
    if (ROUND3(quantity) !== remainingEntry) {
      throw new PurchaseBillReceiptLinePartialException(receiptLine.id);
    }

    const item = await this.requireItem(
      manager,
      organizationId,
      receiptLine.itemId,
    );
    const unitPrice = dtoLine.unitPrice ?? Number(receiptLine.unitCost ?? 0);
    const tax = await this.resolveTaxCode(
      manager,
      organizationId,
      dtoLine.taxCodeId,
      item,
    );
    const tds = await this.resolveTdsCode(
      manager,
      organizationId,
      dtoLine.tdsTaxCodeId,
    );

    return {
      lineNo,
      sourcePurchaseReceiptLineId: receiptLine.id,
      itemId: receiptLine.itemId,
      uomId: receiptLine.uomId,
      quantity,
      baseQuantity: remaining,
      unitPrice,
      grossAmount: ROUND2(quantity * unitPrice),
      discountShare: 0,
      taxCodeId: tax.codeId,
      irdCategory: tax.irdCategory,
      taxRate: tax.rate,
      taxableAmount: 0,
      taxAmount: 0,
      tdsTaxCodeId: tds.codeId,
      tdsRate: tds.rate,
      tdsAmount: 0,
      lineTotal: 0,
    };
  }

  /**
   * Direct flavor (decision 40): goods land on this bill — the POST stocks
   * them in via a `purchase_bill` IN transaction. No source line; item, uom
   * and quantity are required.
   */
  private async prepareDirectLine(
    manager: EntityManager,
    organizationId: string,
    lineNo: number,
    dtoLine: PurchaseBillLineDto,
  ): Promise<PreparedBillLine> {
    if (!dtoLine.itemId || !dtoLine.uomId || !dtoLine.quantity) {
      throw new PurchaseBillDirectLineIncompleteException(lineNo - 1);
    }
    if (dtoLine.quantity <= 0) throw new PurchaseBillZeroQuantityException();

    const item = await this.requireItem(
      manager,
      organizationId,
      dtoLine.itemId,
    );
    const uom = await manager.getRepository(UomEntity).findOne({
      where: { id: dtoLine.uomId, organizationId },
    });
    if (!uom) throw new PurchaseBillUomNotFoundException(dtoLine.uomId);

    const baseQuantity = await this.toBaseQuantity(
      manager,
      organizationId,
      item,
      dtoLine.uomId,
      dtoLine.quantity,
    );
    const unitPrice = dtoLine.unitPrice ?? Number(item.standardCost ?? 0);
    const tax = await this.resolveTaxCode(
      manager,
      organizationId,
      dtoLine.taxCodeId,
      item,
    );
    const tds = await this.resolveTdsCode(
      manager,
      organizationId,
      dtoLine.tdsTaxCodeId,
    );

    return {
      lineNo,
      sourcePurchaseReceiptLineId: null,
      itemId: item.id,
      uomId: uom.id,
      quantity: dtoLine.quantity,
      baseQuantity,
      unitPrice,
      grossAmount: ROUND2(dtoLine.quantity * unitPrice),
      discountShare: 0,
      taxCodeId: tax.codeId,
      irdCategory: tax.irdCategory,
      taxRate: tax.rate,
      taxableAmount: 0,
      taxAmount: 0,
      tdsTaxCodeId: tds.codeId,
      tdsRate: tds.rate,
      tdsAmount: 0,
      lineTotal: 0,
    };
  }

  /**
   * Input-VAT resolution: line override → item `tax_code_id` → first active
   * `TAXABLE` code. TDS withholding codes are rejected here — they belong in
   * `tdsTaxCodeId` (decision 43).
   */
  private async resolveTaxCode(
    manager: EntityManager,
    organizationId: string,
    overrideCodeId: string | null | undefined,
    item: ItemEntity,
  ): Promise<{
    codeId: string | null;
    irdCategory: string | null;
    rate: number;
  }> {
    const repo = manager.getRepository(TaxCodeEntity);
    let code: TaxCodeEntity | null = null;

    if (overrideCodeId) {
      code =
        (await repo.findOne({
          where: { id: overrideCodeId, organizationId, isActive: true },
        })) ?? null;
    }
    if (!code && item.taxCodeId) {
      code =
        (await repo.findOne({
          where: { id: item.taxCodeId, organizationId, isActive: true },
        })) ?? null;
    }
    if (!code) {
      code =
        (await repo.findOne({
          where: { organizationId, irdCategory: 'TAXABLE', isActive: true },
          order: { name: 'ASC' },
        })) ?? null;
    }
    if (!code) {
      return { codeId: null, irdCategory: null, rate: 0 };
    }
    if (code.irdCategory === 'TDS_WITHHOLDING') {
      throw new PurchaseBillTdsWithholdingException(code.name);
    }
    return {
      codeId: code.id,
      irdCategory: code.irdCategory,
      rate: Number(code.rate),
    };
  }

  private async resolveTdsCode(
    manager: EntityManager,
    organizationId: string,
    tdsTaxCodeId: string | null | undefined,
  ): Promise<{ codeId: string | null; rate: number }> {
    if (!tdsTaxCodeId) return { codeId: null, rate: 0 };
    const code = await manager.getRepository(TaxCodeEntity).findOne({
      where: { id: tdsTaxCodeId, organizationId, isActive: true },
    });
    if (!code || code.irdCategory !== 'TDS_WITHHOLDING') {
      throw new PurchaseBillTdsCodeInvalidException(tdsTaxCodeId);
    }
    return { codeId: code.id, rate: Number(code.rate) };
  }

  // ---- Journal ------------------------------------------------------------

  /**
   * Balanced purchase-bill journal (decision 43):
   *   DR Inventory 1104 (goods value, net of the discount recognised on 5104)
   *   DR VAT Receivable 1105 (Σ input VAT)
   *   CR Discounts Received 5104 (header discount, when > 0)
   *   CR TDS Payable 2103 (Σ withheld — AP is net of TDS)
   *   CR Accounts Payable 2101 (total − TDS, with the supplier party)
   * DR Inventory is derived from the header totals so the entry balances
   * exactly (it equals Σ gross when rounding is clean).
   */
  private async journalFor(
    manager: EntityManager,
    organizationId: string,
    bill: PurchaseBillEntity,
  ): Promise<
    Array<{
      accountId: string;
      partyId?: string;
      debit?: number;
      credit?: number;
      description?: string;
    }>
  > {
    const inventory = await this.requirePurposeAccount(
      manager,
      organizationId,
      'INVENTORY',
    );
    const vatReceivable = await this.requirePurposeAccount(
      manager,
      organizationId,
      'TAX_RECEIVABLE',
    );
    const ap = await this.requirePurposeAccount(
      manager,
      organizationId,
      'ACCOUNTS_PAYABLE',
    );

    const total = Number(bill.total);
    const discountTotal = Number(bill.discountTotal);
    const taxTotal = Number(bill.taxTotal);
    const tdsTotal = Number(bill.tdsTotal);

    const inventoryAmount = ROUND2(total + discountTotal - taxTotal);
    const apAmount = ROUND2(total - tdsTotal);

    const lines: Array<{
      accountId: string;
      partyId?: string;
      debit?: number;
      credit?: number;
      description?: string;
    }> = [
      {
        accountId: inventory.id,
        debit: inventoryAmount,
        description: 'Inventory in',
      },
      {
        accountId: ap.id,
        partyId: bill.partyId,
        credit: apAmount,
        description: `Payable ${bill.billNumber ?? ''}`.trim(),
      },
    ];
    if (taxTotal > 0) {
      lines.push({
        accountId: vatReceivable.id,
        debit: taxTotal,
        description: 'Input VAT',
      });
    }
    if (tdsTotal > 0) {
      const tdsPayable = await this.requirePurposeAccount(
        manager,
        organizationId,
        'TDS_PAYABLE',
      );
      lines.push({
        accountId: tdsPayable.id,
        credit: tdsTotal,
        description: 'TDS withheld',
      });
    }
    if (discountTotal > 0) {
      const discounts = await this.requirePurposeAccount(
        manager,
        organizationId,
        'DISCOUNT_RECEIVED',
      );
      lines.push({
        accountId: discounts.id,
        credit: discountTotal,
        description: 'Purchase discounts',
      });
    }
    return lines;
  }

  private async requirePurposeAccount(
    manager: EntityManager,
    organizationId: string,
    purpose: SystemPurpose,
  ): Promise<AccountEntity> {
    const account = await manager.getRepository(AccountEntity).findOne({
      where: { organizationId, systemPurpose: purpose, isActive: true },
    });
    if (!account) {
      throw new PurchaseBillAccountMissingException(purpose);
    }
    return account;
  }

  // ---- Shared -------------------------------------------------------------

  private async saveLines(
    manager: EntityManager,
    organizationId: string,
    billId: string,
    lines: PreparedBillLine[],
  ): Promise<void> {
    const lineRepo = manager.getRepository(PurchaseBillLineEntity);
    await lineRepo.save(
      lines.map((line) =>
        lineRepo.create({
          organizationId,
          billId,
          lineNo: line.lineNo,
          sourcePurchaseReceiptLineId: line.sourcePurchaseReceiptLineId,
          itemId: line.itemId,
          uomId: line.uomId,
          quantity: line.quantity.toFixed(3),
          baseQuantity: line.baseQuantity.toFixed(3),
          unitPrice: line.unitPrice.toFixed(2),
          grossAmount: line.grossAmount.toFixed(2),
          taxCodeId: line.taxCodeId,
          irdCategory: line.irdCategory,
          taxRate: line.taxRate.toFixed(4),
          taxableAmount: line.taxableAmount.toFixed(2),
          taxAmount: line.taxAmount.toFixed(2),
          tdsTaxCodeId: line.tdsTaxCodeId,
          tdsRate: line.tdsRate.toFixed(4),
          tdsAmount: line.tdsAmount.toFixed(2),
          lineTotal: line.lineTotal.toFixed(2),
        }),
      ),
    );
  }

  private async toLineDtos(
    manager: EntityManager,
    bill: PurchaseBillEntity,
  ): Promise<PurchaseBillLineDto[]> {
    const lines = await manager.getRepository(PurchaseBillLineEntity).find({
      where: { billId: bill.id },
      order: { lineNo: 'ASC' },
    });
    return lines.map((line) => ({
      sourcePurchaseReceiptLineId:
        line.sourcePurchaseReceiptLineId ?? undefined,
      itemId: line.sourcePurchaseReceiptLineId ? undefined : line.itemId,
      uomId: line.sourcePurchaseReceiptLineId ? undefined : line.uomId,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      taxCodeId: line.taxCodeId ?? undefined,
      tdsTaxCodeId: line.tdsTaxCodeId ?? undefined,
    }));
  }

  private async requireBill(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<PurchaseBillEntity> {
    const bill = await manager.getRepository(PurchaseBillEntity).findOne({
      where: { id, organizationId },
      relations: { party: true },
    });
    if (!bill) throw new PurchaseBillNotFoundException(id);
    return bill;
  }

  private async buildBillView(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<PurchaseBillEntity> {
    const bill = await manager.getRepository(PurchaseBillEntity).findOne({
      where: { id, organizationId },
      relations: {
        party: true,
        branch: true,
        fiscalYear: true,
        inventoryLocation: true,
        inventoryTransaction: true,
        journalEntry: true,
      },
    });
    if (!bill) throw new PurchaseBillNotFoundException(id);
    bill.lines = await manager.getRepository(PurchaseBillLineEntity).find({
      where: { billId: bill.id },
      relations: {
        item: true,
        uom: true,
        taxCode: true,
        tdsTaxCode: true,
        sourceReceiptLine: true,
      },
      order: { lineNo: 'ASC' },
    });
    return bill;
  }

  private async requireSupplier(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
  ): Promise<PartyEntity> {
    const supplier = await manager.getRepository(PartyEntity).findOne({
      where: { id: partyId, organizationId, isSupplier: true, isActive: true },
    });
    if (!supplier) throw new PurchaseBillSupplierNotFoundException(partyId);
    return supplier;
  }

  private async assertSupplierActive(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
  ): Promise<void> {
    await this.requireSupplier(manager, organizationId, partyId);
  }

  private async requireLocation(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<InventoryLocationEntity> {
    const location = await manager
      .getRepository(InventoryLocationEntity)
      .findOne({
        where: { id, organizationId, isActive: true },
      });
    if (!location) throw new PurchaseBillLocationNotFoundException(id);
    return location;
  }

  private async requireItem(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<ItemEntity> {
    const item = await manager.getRepository(ItemEntity).findOne({
      where: { id, organizationId, isActive: true },
    });
    if (!item) throw new PurchaseBillItemNotFoundException(id);
    if (item.inventoryTracking !== 'QUANTITY') {
      throw new PurchaseBillItemNotTrackedException(id, item.inventoryTracking);
    }
    return item;
  }

  private async lockReceiptLine(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<PurchaseReceiptLineEntity> {
    const line = await manager
      .getRepository(PurchaseReceiptLineEntity)
      .createQueryBuilder('line')
      .innerJoinAndSelect('line.receipt', 'receipt')
      .where('line.organizationId = :organizationId', { organizationId })
      .andWhere('line.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
    if (!line) throw new PurchaseBillReceiptLineNotFoundException(id);
    return line;
  }

  private async toBaseQuantity(
    manager: EntityManager,
    organizationId: string,
    item: ItemEntity,
    uomId: string,
    quantity: number,
  ): Promise<number> {
    if (uomId === item.baseUomId) return ROUND3(quantity);

    const conversion = await manager
      .getRepository(UomConversionEntity)
      .createQueryBuilder('conversion')
      .where('conversion.organizationId = :organizationId', { organizationId })
      .andWhere('conversion.fromUomId = :fromUomId', { fromUomId: uomId })
      .andWhere('conversion.toUomId = :toUomId', { toUomId: item.baseUomId })
      .andWhere('conversion.itemId IS NULL OR conversion.itemId = :itemId', {
        itemId: item.id,
      })
      .orderBy('conversion.itemId', 'DESC', 'NULLS LAST')
      .getOne();

    if (!conversion)
      throw new PurchaseBillUomConversionNotFoundException(
        uomId,
        item.baseUomId,
        item.id,
      );

    return ROUND3(Number(quantity) * Number(conversion.conversionFactor));
  }

  private async resolveFiscalYear(
    manager: EntityManager,
    organizationId: string,
    date: Date,
  ): Promise<FiscalYearEntity> {
    const fiscalYear = await manager.getRepository(FiscalYearEntity).findOne({
      where: {
        organizationId,
        isActive: true,
        isClosed: false,
        startDate: LessThanOrEqual(date),
        endDate: MoreThanOrEqual(date),
      },
    });
    if (!fiscalYear) {
      throw new PurchaseBillFiscalYearMissingException();
    }
    return fiscalYear;
  }

  private async requireDefaultBranch(
    manager: EntityManager,
    organizationId: string,
  ): Promise<string> {
    const branch = await manager.getRepository(BranchEntity).findOne({
      where: { organizationId, isActive: true },
      order: { name: 'ASC' },
    });
    if (!branch) {
      throw new PurchaseBillAccountMissingException('BRANCH');
    }
    return branch.id;
  }

  private toBs(date: Date): string {
    const bs = this.nepaliDate.adToBs(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
    );
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${bs.bsYear}-${pad(bs.bsMonth)}-${pad(bs.bsDay)}`;
  }
}
