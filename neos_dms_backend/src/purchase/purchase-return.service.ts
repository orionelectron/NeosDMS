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
import type { SystemPurpose } from '../accounting/accounting.constants';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { JournalService } from '../accounting/journal.service';
import { AuditService } from '../audit/audit.service';
import { InventoryLocationEntity } from '../inventory/entities/inventory-location.entity';
import { InventoryService } from '../inventory/inventory.service';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { BranchEntity } from '../tenancy/entities/branch.entity';
import {
  CreatePurchaseReturnDto,
  PostPurchaseReturnDto,
  PurchaseReturnLineDto,
  PurchaseReturnQueryDto,
  UpdatePurchaseReturnDto,
} from './dto/purchase-return.dto';
import { PurchaseBillEntity } from './entities/purchase-bill.entity';
import { PurchaseBillLineEntity } from './entities/purchase-bill-line.entity';
import { PurchaseReceiptLineEntity } from './entities/purchase-receipt-line.entity';
import { PurchaseReturnLineEntity } from './entities/purchase-return-line.entity';
import { PurchaseReturnEntity } from './entities/purchase-return.entity';
import {
  PURCHASE_AUDIT_ACTIONS,
  PURCHASE_RETURN_DOCUMENT_TYPE,
  PURCHASE_RETURN_NUMBER_PREFIX,
} from './purchase.constants';
import {
  PurchaseReturnAccountMissingException,
  PurchaseReturnFiscalYearMissingException,
  PurchaseReturnLineIncompleteException,
  PurchaseReturnLocationMismatchException,
  PurchaseReturnLocationNotFoundException,
  PurchaseReturnNoRemainingException,
  PurchaseReturnNotDraftException,
  PurchaseReturnNotFoundException,
  PurchaseReturnQuantityExceededException,
  PurchaseReturnReceiptLineBilledException,
  PurchaseReturnSourceBillLineNotFoundException,
  PurchaseReturnSourceNotPostedException,
  PurchaseReturnSourceReceiptLineNotFoundException,
  PurchaseReturnSupplierMismatchException,
  PurchaseReturnSupplierNotFoundException,
  PurchaseReturnZeroQuantityException,
} from './purchase.errors';

const ROUND2 = (n: number): number => Math.round(n * 100) / 100;
const ROUND3 = (n: number): number => Math.round(n * 1000) / 1000;

interface PreparedReturnLine {
  lineNo: number;
  sourcePurchaseBillLineId: string | null;
  sourcePurchaseReceiptLineId: string | null;
  itemId: string;
  uomId: string;
  quantity: number;
  baseQuantity: number;
  unitPrice: number;
  grossAmount: number;
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

interface PreparedReturn {
  lines: PreparedReturnLine[];
  taxableTotal: number;
  nonTaxableTotal: number;
  subtotal: number;
  taxTotal: number;
  tdsTotal: number;
  total: number;
}

@Injectable()
export class PurchaseReturnService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(PurchaseReturnEntity)
    private readonly returnRepo: Repository<PurchaseReturnEntity>,
    private readonly audit: AuditService,
    private readonly documentSequenceService: DocumentSequenceService,
    private readonly journalService: JournalService,
    private readonly inventoryService: InventoryService,
    private readonly nepaliDate: NepaliDateConverter,
  ) {}

  // ---- Mutations ----------------------------------------------------------

  async create(
    organizationId: string,
    actorId: string,
    dto: CreatePurchaseReturnDto,
  ): Promise<PurchaseReturnEntity> {
    return this.dataSource.transaction(async (manager) => {
      const supplier = await this.requireSupplier(
        manager,
        organizationId,
        dto.partyId,
      );
      const prepared = await this.prepareReturn(
        manager,
        organizationId,
        supplier.id,
        dto.lines,
      );

      const returnRepo = manager.getRepository(PurchaseReturnEntity);
      const purchaseReturn = await returnRepo.save(
        returnRepo.create({
          organizationId,
          branchId: dto.branchId ?? null,
          returnNumber: null,
          partyId: supplier.id,
          status: 'DRAFT',
          inventoryLocationId: null,
          taxableTotal: prepared.taxableTotal.toFixed(2),
          nonTaxableTotal: prepared.nonTaxableTotal.toFixed(2),
          subtotal: prepared.subtotal.toFixed(2),
          discountTotal: '0.00',
          taxTotal: prepared.taxTotal.toFixed(2),
          tdsTotal: prepared.tdsTotal.toFixed(2),
          total: prepared.total.toFixed(2),
          returnReason: dto.returnReason ?? null,
          notes: dto.notes ?? null,
        }),
      );

      await this.saveLines(
        manager,
        organizationId,
        purchaseReturn.id,
        prepared.lines,
      );

      await this.audit.record(
        {
          organizationId,
          branchId: purchaseReturn.branchId,
          userId: actorId,
          action: PURCHASE_AUDIT_ACTIONS.RETURN_CREATE,
          entityType: 'purchase_return',
          entityId: purchaseReturn.id,
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

      return this.buildReturnView(manager, organizationId, purchaseReturn.id);
    });
  }

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdatePurchaseReturnDto,
  ): Promise<PurchaseReturnEntity> {
    return this.dataSource.transaction(async (manager) => {
      const purchaseReturn = await this.requireReturn(
        manager,
        organizationId,
        id,
      );
      if (purchaseReturn.status !== 'DRAFT') {
        throw new PurchaseReturnNotDraftException(
          id,
          purchaseReturn.status,
          'update',
        );
      }

      if (dto.partyId !== undefined && dto.partyId !== purchaseReturn.partyId) {
        const supplier = await this.requireSupplier(
          manager,
          organizationId,
          dto.partyId,
        );
        purchaseReturn.partyId = supplier.id;
      }
      if (dto.branchId !== undefined) purchaseReturn.branchId = dto.branchId;
      if (dto.returnReason !== undefined)
        purchaseReturn.returnReason = dto.returnReason;
      if (dto.notes !== undefined) purchaseReturn.notes = dto.notes;

      const effectiveLines =
        dto.lines ?? (await this.toLineDtos(manager, purchaseReturn));
      const prepared = await this.prepareReturn(
        manager,
        organizationId,
        purchaseReturn.partyId,
        effectiveLines,
      );

      purchaseReturn.taxableTotal = prepared.taxableTotal.toFixed(2);
      purchaseReturn.nonTaxableTotal = prepared.nonTaxableTotal.toFixed(2);
      purchaseReturn.subtotal = prepared.subtotal.toFixed(2);
      purchaseReturn.taxTotal = prepared.taxTotal.toFixed(2);
      purchaseReturn.tdsTotal = prepared.tdsTotal.toFixed(2);
      purchaseReturn.total = prepared.total.toFixed(2);

      const lineRepo = manager.getRepository(PurchaseReturnLineEntity);
      await lineRepo.delete({ returnId: purchaseReturn.id });
      await this.saveLines(
        manager,
        organizationId,
        purchaseReturn.id,
        prepared.lines,
      );
      await manager.getRepository(PurchaseReturnEntity).save(purchaseReturn);

      await this.audit.record(
        {
          organizationId,
          branchId: purchaseReturn.branchId,
          userId: actorId,
          action: PURCHASE_AUDIT_ACTIONS.RETURN_UPDATE,
          entityType: 'purchase_return',
          entityId: purchaseReturn.id,
          newData: {
            status: 'DRAFT',
            partyId: purchaseReturn.partyId,
            total: purchaseReturn.total,
            lineCount: prepared.lines.length,
          },
        },
        manager,
      );

      return this.buildReturnView(manager, organizationId, purchaseReturn.id);
    });
  }

  /**
   * Posts a draft: reserves the `DN-` number, moves stock out for every line,
   * posts the reverse Inventory/VAT/TDS/AP journal for bill-sourced lines,
   * and stamps `returned_quantity` on the source lines — all in one
   * transaction. Source lines are re-validated FOR UPDATE so concurrent
   * returns can never over-return, and a concurrent bill can never claim
   * already-returned quantity.
   */
  async post(
    organizationId: string,
    actorId: string,
    id: string,
    dto: PostPurchaseReturnDto,
  ): Promise<PurchaseReturnEntity> {
    const postedId = await this.dataSource.transaction(async (manager) => {
      const purchaseReturn = await this.requireReturn(
        manager,
        organizationId,
        id,
      );
      if (purchaseReturn.status !== 'DRAFT') {
        throw new PurchaseReturnNotDraftException(
          id,
          purchaseReturn.status,
          'post',
        );
      }
      await this.assertSupplierActive(
        manager,
        organizationId,
        purchaseReturn.partyId,
      );
      await this.requireLocation(
        manager,
        organizationId,
        dto.inventoryLocationId,
      );

      const lines = await manager.getRepository(PurchaseReturnLineEntity).find({
        where: { returnId: purchaseReturn.id },
        order: { lineNo: 'ASC' },
      });

      // Re-validate every source line against its live row (locked FOR
      // UPDATE) and accumulate the returned-quantity stamps.
      const billStamps: Array<{
        line: PurchaseBillLineEntity;
        baseQuantity: number;
      }> = [];
      const receiptStamps: Array<{
        line: PurchaseReceiptLineEntity;
        baseQuantity: number;
      }> = [];
      // Bill id → AP settled by this return (gross − TDS, per bill).
      const billBalanceReductions = new Map<string, number>();
      for (const line of lines) {
        if (line.sourcePurchaseBillLineId) {
          const billLine = await this.lockBillLine(
            manager,
            organizationId,
            line.sourcePurchaseBillLineId,
          );
          if (billLine.bill.status !== 'POSTED') {
            throw new PurchaseReturnSourceNotPostedException(
              'purchase bill',
              billLine.billId,
            );
          }
          if (billLine.bill.partyId !== purchaseReturn.partyId) {
            throw new PurchaseReturnSupplierMismatchException(billLine.id);
          }
          if (billLine.bill.inventoryLocationId !== dto.inventoryLocationId) {
            throw new PurchaseReturnLocationMismatchException(
              billLine.id,
              billLine.bill.inventoryLocationId,
            );
          }
          const remaining = ROUND3(
            Number(billLine.baseQuantity) - Number(billLine.returnedQuantity),
          );
          if (remaining <= 0) {
            throw new PurchaseReturnNoRemainingException(billLine.id);
          }
          if (ROUND3(Number(line.baseQuantity)) > remaining) {
            throw new PurchaseReturnQuantityExceededException(
              billLine.id,
              remaining.toFixed(3),
            );
          }
          billStamps.push({
            line: billLine,
            baseQuantity: Number(line.baseQuantity),
          });
          const net = ROUND2(Number(line.grossAmount) - Number(line.tdsAmount));
          billBalanceReductions.set(
            billLine.billId,
            (billBalanceReductions.get(billLine.billId) ?? 0) + net,
          );
        } else if (line.sourcePurchaseReceiptLineId) {
          const receiptLine = await this.lockReceiptLine(
            manager,
            organizationId,
            line.sourcePurchaseReceiptLineId,
          );
          if (receiptLine.receipt.status !== 'POSTED') {
            throw new PurchaseReturnSourceNotPostedException(
              'goods receipt',
              receiptLine.receiptId,
            );
          }
          if (receiptLine.receipt.partyId !== purchaseReturn.partyId) {
            throw new PurchaseReturnSupplierMismatchException(receiptLine.id);
          }
          if (
            receiptLine.receipt.inventoryLocationId !== dto.inventoryLocationId
          ) {
            throw new PurchaseReturnLocationMismatchException(
              receiptLine.id,
              receiptLine.receipt.inventoryLocationId,
            );
          }
          if (Number(receiptLine.billedQuantity) > 0) {
            throw new PurchaseReturnReceiptLineBilledException(receiptLine.id);
          }
          const remaining = ROUND3(
            Number(receiptLine.baseQuantity) -
              Number(receiptLine.returnedQuantity),
          );
          if (remaining <= 0) {
            throw new PurchaseReturnNoRemainingException(receiptLine.id);
          }
          if (ROUND3(Number(line.baseQuantity)) > remaining) {
            throw new PurchaseReturnQuantityExceededException(
              receiptLine.id,
              remaining.toFixed(3),
            );
          }
          receiptStamps.push({
            line: receiptLine,
            baseQuantity: Number(line.baseQuantity),
          });
        }
      }

      const today = new Date();
      const todayBs = this.toBs(today);
      const fiscalYear = await this.resolveFiscalYear(
        manager,
        organizationId,
        today,
      );

      const returnNumber = await this.documentSequenceService.nextNumber(
        {
          organizationId,
          branchId: purchaseReturn.branchId,
          fiscalYearId: fiscalYear.id,
          documentType: PURCHASE_RETURN_DOCUMENT_TYPE,
          prefix: PURCHASE_RETURN_NUMBER_PREFIX,
        },
        manager,
      );

      let journalEntryId: string | null = null;
      if (lines.some((line) => line.sourcePurchaseBillLineId)) {
        const journalBranchId =
          purchaseReturn.branchId ??
          (await this.requireDefaultBranch(manager, organizationId));
        const journal = await this.journalFor(
          manager,
          organizationId,
          purchaseReturn,
        );
        const entry = await this.journalService.createDraftIn(
          manager,
          organizationId,
          {
            branchId: journalBranchId,
            entryDate: today.toISOString().slice(0, 10),
            description: `Purchase return ${returnNumber}`,
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
        // journal for the same return (uq_journal_entries_source).
        await manager.getRepository(JournalEntryEntity).update(entry.id, {
          sourceType: 'purchase_return',
          sourceId: purchaseReturn.id,
        });
        journalEntryId = entry.id;
      }

      const inventoryTxn = await this.inventoryService.receiveForPurchaseReturn(
        manager,
        organizationId,
        {
          locationId: dto.inventoryLocationId,
          returnId: purchaseReturn.id,
          notes: `Purchase return ${returnNumber}`,
          lines: lines.map((line) => ({
            itemId: line.itemId,
            uomId: line.uomId,
            baseQuantity: Number(line.baseQuantity),
            value: Number(line.grossAmount),
          })),
        },
        actorId,
      );

      const billLineRepo = manager.getRepository(PurchaseBillLineEntity);
      for (const stamp of billStamps) {
        await billLineRepo.update(
          { id: stamp.line.id },
          {
            returnedQuantity: ROUND3(
              Number(stamp.line.returnedQuantity) + stamp.baseQuantity,
            ).toFixed(3),
          },
        );
      }
      const receiptLineRepo = manager.getRepository(PurchaseReceiptLineEntity);
      for (const stamp of receiptStamps) {
        await receiptLineRepo.update(
          { id: stamp.line.id },
          {
            returnedQuantity: ROUND3(
              Number(stamp.line.returnedQuantity) + stamp.baseQuantity,
            ).toFixed(3),
          },
        );
      }

      // Decrement each affected bill's outstanding AP (balance_amount). The
      // bill rows lock FOR UPDATE so a concurrent payment serializes on the
      // same row and can never allocate against the returned amount.
      const billRepo = manager.getRepository(PurchaseBillEntity);
      for (const [billId, net] of billBalanceReductions) {
        const bill = await this.lockBill(manager, organizationId, billId);
        await billRepo.update(
          { id: bill.id },
          {
            balanceAmount: ROUND2(Number(bill.balanceAmount) - net).toFixed(2),
          },
        );
      }

      purchaseReturn.status = 'POSTED';
      purchaseReturn.returnNumber = returnNumber;
      purchaseReturn.returnDate = today.toISOString().slice(0, 10);
      purchaseReturn.returnDateBs = todayBs;
      purchaseReturn.fiscalYearId = fiscalYear.id;
      purchaseReturn.inventoryLocationId = dto.inventoryLocationId;
      purchaseReturn.journalEntryId = journalEntryId;
      purchaseReturn.inventoryTransactionId = inventoryTxn.id;
      await manager.getRepository(PurchaseReturnEntity).save(purchaseReturn);

      await this.audit.record(
        {
          organizationId,
          branchId: purchaseReturn.branchId,
          userId: actorId,
          action: PURCHASE_AUDIT_ACTIONS.RETURN_POST,
          entityType: 'purchase_return',
          entityId: purchaseReturn.id,
          newData: {
            returnNumber,
            status: 'POSTED',
            journalEntryId,
            inventoryTransactionId: inventoryTxn.id,
            locationId: dto.inventoryLocationId,
            total: purchaseReturn.total,
            tdsTotal: purchaseReturn.tdsTotal,
            lineCount: lines.length,
          },
        },
        manager,
      );

      return purchaseReturn.id;
    });

    return this.get(organizationId, postedId);
  }

  async voidReturn(
    organizationId: string,
    actorId: string,
    id: string,
  ): Promise<PurchaseReturnEntity> {
    return this.dataSource.transaction(async (manager) => {
      const purchaseReturn = await this.requireReturn(
        manager,
        organizationId,
        id,
      );
      if (purchaseReturn.status !== 'DRAFT') {
        throw new PurchaseReturnNotDraftException(
          id,
          purchaseReturn.status,
          'void',
        );
      }

      purchaseReturn.status = 'CANCELLED';
      await manager.getRepository(PurchaseReturnEntity).save(purchaseReturn);
      await this.audit.record(
        {
          organizationId,
          branchId: purchaseReturn.branchId,
          userId: actorId,
          action: PURCHASE_AUDIT_ACTIONS.RETURN_VOID,
          entityType: 'purchase_return',
          entityId: purchaseReturn.id,
          newData: { status: 'CANCELLED' },
        },
        manager,
      );

      return this.buildReturnView(manager, organizationId, purchaseReturn.id);
    });
  }

  // ---- Reads --------------------------------------------------------------

  async get(organizationId: string, id: string): Promise<PurchaseReturnEntity> {
    return this.buildReturnView(this.dataSource.manager, organizationId, id);
  }

  async list(
    organizationId: string,
    query: PurchaseReturnQueryDto,
  ): Promise<[PurchaseReturnEntity[], number]> {
    const qb = this.returnRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.party', 'party')
      .leftJoinAndSelect('r.inventoryLocation', 'inventoryLocation')
      .where('r.organization_id = :organizationId', { organizationId });

    if (query.status)
      qb.andWhere('r.status = :status', { status: query.status });
    if (query.partyId)
      qb.andWhere('r.party_id = :partyId', { partyId: query.partyId });

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('r.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getMany();
    return [rows, total];
  }

  // ---- Preparation --------------------------------------------------------

  private async prepareReturn(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
    lines: PurchaseReturnLineDto[],
  ): Promise<PreparedReturn> {
    const prepared: PreparedReturnLine[] = [];
    for (const [index, dtoLine] of lines.entries()) {
      prepared.push(
        await this.prepareLine(
          manager,
          organizationId,
          partyId,
          index + 1,
          dtoLine,
        ),
      );
    }

    let taxableTotal = 0;
    let nonTaxableTotal = 0;
    let subtotal = 0;
    let taxTotal = 0;
    let tdsTotal = 0;
    for (const line of prepared) {
      subtotal += line.grossAmount;
      if (line.taxRate > 0) taxableTotal += line.taxableAmount;
      else nonTaxableTotal += line.grossAmount;
      taxTotal += line.taxAmount;
      tdsTotal += line.tdsAmount;
    }

    return {
      lines: prepared,
      taxableTotal: ROUND2(taxableTotal),
      nonTaxableTotal: ROUND2(nonTaxableTotal),
      subtotal: ROUND2(subtotal),
      taxTotal: ROUND2(taxTotal),
      tdsTotal: ROUND2(tdsTotal),
      total: ROUND2(subtotal + taxTotal),
    };
  }

  /**
   * Bill-sourced line: reverses the bill line's snapshotted price/tax/TDS
   * (a debit note reverses the original transaction). The return line's
   * taxable base is its own gross — header discounts stay recognized. Only
   * `base_quantity − returned_quantity` can ever be returned.
   */
  private async prepareBillSourcedLine(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
    lineNo: number,
    sourceId: string,
    quantityOverride: number | undefined,
  ): Promise<PreparedReturnLine> {
    const billLine = await manager
      .getRepository(PurchaseBillLineEntity)
      .findOne({
        where: { id: sourceId, organizationId },
        relations: { bill: true },
      });
    if (!billLine)
      throw new PurchaseReturnSourceBillLineNotFoundException(sourceId);
    if (billLine.bill.status !== 'POSTED') {
      throw new PurchaseReturnSourceNotPostedException(
        'purchase bill',
        billLine.billId,
      );
    }
    if (billLine.bill.partyId !== partyId) {
      throw new PurchaseReturnSupplierMismatchException(billLine.id);
    }

    const remaining = ROUND3(
      Number(billLine.baseQuantity) - Number(billLine.returnedQuantity),
    );
    if (remaining <= 0) {
      throw new PurchaseReturnNoRemainingException(billLine.id);
    }
    const quantity =
      quantityOverride ??
      this.defaultReturnQuantity(
        billLine.quantity,
        remaining,
        billLine.baseQuantity,
      );

    const baseQuantity = ROUND3(
      quantity * (Number(billLine.baseQuantity) / Number(billLine.quantity)),
    );
    if (ROUND3(baseQuantity) > remaining) {
      throw new PurchaseReturnQuantityExceededException(
        billLine.id,
        remaining.toFixed(3),
      );
    }

    const unitPrice = Number(billLine.unitPrice);
    const grossAmount = ROUND2(quantity * unitPrice);
    const taxRate = Number(billLine.taxRate);
    const taxableAmount = grossAmount;
    const taxAmount = ROUND2(taxableAmount * (taxRate / 100));
    const tdsRate = Number(billLine.tdsRate);
    const tdsAmount = ROUND2(taxableAmount * (tdsRate / 100));

    return {
      lineNo,
      sourcePurchaseBillLineId: billLine.id,
      sourcePurchaseReceiptLineId: null,
      itemId: billLine.itemId,
      uomId: billLine.uomId,
      quantity: ROUND3(quantity),
      baseQuantity,
      unitPrice,
      grossAmount,
      taxCodeId: billLine.taxCodeId,
      irdCategory: billLine.irdCategory,
      taxRate,
      taxableAmount,
      taxAmount,
      tdsTaxCodeId: billLine.tdsTaxCodeId,
      tdsRate,
      tdsAmount,
      lineTotal: ROUND2(taxableAmount + taxAmount),
    };
  }

  /**
   * Never-billed GRN line (decision 41): stock-out only. No value was ever
   * recognized on the GRN, so the return moves the quantity out at value 0 —
   * the pool value stays and avg_cost rises. `unitCost` is informational.
   */
  private async prepareReceiptSourcedLine(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
    lineNo: number,
    sourceId: string,
    quantityOverride: number | undefined,
  ): Promise<PreparedReturnLine> {
    const receiptLine = await manager
      .getRepository(PurchaseReceiptLineEntity)
      .findOne({
        where: { id: sourceId, organizationId },
        relations: { receipt: true },
      });
    if (!receiptLine)
      throw new PurchaseReturnSourceReceiptLineNotFoundException(sourceId);
    if (receiptLine.receipt.status !== 'POSTED') {
      throw new PurchaseReturnSourceNotPostedException(
        'goods receipt',
        receiptLine.receiptId,
      );
    }
    if (receiptLine.receipt.partyId !== partyId) {
      throw new PurchaseReturnSupplierMismatchException(receiptLine.id);
    }
    if (Number(receiptLine.billedQuantity) > 0) {
      throw new PurchaseReturnReceiptLineBilledException(receiptLine.id);
    }

    const remaining = ROUND3(
      Number(receiptLine.baseQuantity) - Number(receiptLine.returnedQuantity),
    );
    if (remaining <= 0) {
      throw new PurchaseReturnNoRemainingException(receiptLine.id);
    }
    const quantity =
      quantityOverride ??
      this.defaultReturnQuantity(
        receiptLine.quantity,
        remaining,
        receiptLine.baseQuantity,
      );

    const baseQuantity = ROUND3(
      quantity *
        (Number(receiptLine.baseQuantity) / Number(receiptLine.quantity)),
    );
    if (ROUND3(baseQuantity) > remaining) {
      throw new PurchaseReturnQuantityExceededException(
        receiptLine.id,
        remaining.toFixed(3),
      );
    }

    return {
      lineNo,
      sourcePurchaseBillLineId: null,
      sourcePurchaseReceiptLineId: receiptLine.id,
      itemId: receiptLine.itemId,
      uomId: receiptLine.uomId,
      quantity: ROUND3(quantity),
      baseQuantity,
      unitPrice: Number(receiptLine.unitCost ?? 0),
      grossAmount: 0,
      taxCodeId: null,
      irdCategory: null,
      taxRate: 0,
      taxableAmount: 0,
      taxAmount: 0,
      tdsTaxCodeId: null,
      tdsRate: 0,
      tdsAmount: 0,
      lineTotal: 0,
    };
  }

  private async prepareLine(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
    lineNo: number,
    dtoLine: PurchaseReturnLineDto,
  ): Promise<PreparedReturnLine> {
    const billSourceId = dtoLine.sourcePurchaseBillLineId ?? null;
    const receiptSourceId = dtoLine.sourcePurchaseReceiptLineId ?? null;
    if (
      (billSourceId && receiptSourceId) ||
      (!billSourceId && !receiptSourceId)
    ) {
      throw new PurchaseReturnLineIncompleteException(lineNo - 1);
    }
    if (dtoLine.quantity !== undefined && dtoLine.quantity <= 0) {
      throw new PurchaseReturnZeroQuantityException();
    }
    if (billSourceId) {
      return this.prepareBillSourcedLine(
        manager,
        organizationId,
        partyId,
        lineNo,
        billSourceId,
        dtoLine.quantity,
      );
    }
    return this.prepareReceiptSourcedLine(
      manager,
      organizationId,
      partyId,
      lineNo,
      receiptSourceId!,
      dtoLine.quantity,
    );
  }

  /** Remaining quantity in the entry uom: `quantity × remaining / base`. */
  private defaultReturnQuantity(
    quantity: string,
    remainingBase: number,
    baseQuantity: string,
  ): number {
    const base = Number(baseQuantity);
    return base > 0
      ? ROUND3(Number(quantity) * (remainingBase / base))
      : ROUND3(Number(quantity));
  }

  // ---- Journal ------------------------------------------------------------

  /**
   * Balanced reverse journal for bill-sourced returns (decision 41/43) — the
   * exact mirror of the bill entry:
   *   DR Accounts Payable 2101 (total − TDS, with the supplier party)
   *   DR TDS Payable 2103 (Σ withheld reversed — AP is net of TDS)
   *   CR Inventory 1104 (Σ returned gross — value leaves at original cost)
   *   CR VAT Receivable 1105 (Σ input VAT reversed)
   * Only called when at least one bill-sourced line exists.
   */
  private async journalFor(
    manager: EntityManager,
    organizationId: string,
    purchaseReturn: PurchaseReturnEntity,
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

    const total = Number(purchaseReturn.total);
    const taxTotal = Number(purchaseReturn.taxTotal);
    const tdsTotal = Number(purchaseReturn.tdsTotal);
    const inventoryAmount = ROUND2(total - taxTotal);
    const apAmount = ROUND2(total - tdsTotal);

    const lines: Array<{
      accountId: string;
      partyId?: string;
      debit?: number;
      credit?: number;
      description?: string;
    }> = [
      {
        accountId: ap.id,
        partyId: purchaseReturn.partyId,
        debit: apAmount,
        description: `Debit note ${purchaseReturn.returnNumber ?? ''}`.trim(),
      },
      {
        accountId: inventory.id,
        credit: inventoryAmount,
        description: 'Inventory out',
      },
    ];
    if (taxTotal > 0) {
      lines.push({
        accountId: vatReceivable.id,
        credit: taxTotal,
        description: 'Input VAT reversed',
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
        debit: tdsTotal,
        description: 'TDS reversed',
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
      throw new PurchaseReturnAccountMissingException(purpose);
    }
    return account;
  }

  // ---- Shared -------------------------------------------------------------

  private async saveLines(
    manager: EntityManager,
    organizationId: string,
    returnId: string,
    lines: PreparedReturnLine[],
  ): Promise<void> {
    const lineRepo = manager.getRepository(PurchaseReturnLineEntity);
    await lineRepo.save(
      lines.map((line) =>
        lineRepo.create({
          organizationId,
          returnId,
          lineNo: line.lineNo,
          sourcePurchaseBillLineId: line.sourcePurchaseBillLineId,
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
    purchaseReturn: PurchaseReturnEntity,
  ): Promise<PurchaseReturnLineDto[]> {
    const lines = await manager.getRepository(PurchaseReturnLineEntity).find({
      where: { returnId: purchaseReturn.id },
      order: { lineNo: 'ASC' },
    });
    return lines.map((line) => ({
      sourcePurchaseBillLineId: line.sourcePurchaseBillLineId ?? undefined,
      sourcePurchaseReceiptLineId:
        line.sourcePurchaseReceiptLineId ?? undefined,
      quantity: Number(line.quantity),
    }));
  }

  private async requireReturn(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<PurchaseReturnEntity> {
    const purchaseReturn = await manager
      .getRepository(PurchaseReturnEntity)
      .findOne({
        where: { id, organizationId },
        relations: { party: true },
      });
    if (!purchaseReturn) throw new PurchaseReturnNotFoundException(id);
    return purchaseReturn;
  }

  private async buildReturnView(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<PurchaseReturnEntity> {
    const purchaseReturn = await manager
      .getRepository(PurchaseReturnEntity)
      .findOne({
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
    if (!purchaseReturn) throw new PurchaseReturnNotFoundException(id);
    purchaseReturn.lines = await manager
      .getRepository(PurchaseReturnLineEntity)
      .find({
        where: { returnId: purchaseReturn.id },
        relations: {
          item: true,
          uom: true,
          taxCode: true,
          tdsTaxCode: true,
          sourceBillLine: true,
          sourceReceiptLine: true,
        },
        order: { lineNo: 'ASC' },
      });
    return purchaseReturn;
  }

  private async requireSupplier(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
  ): Promise<PartyEntity> {
    const supplier = await manager.getRepository(PartyEntity).findOne({
      where: { id: partyId, organizationId, isSupplier: true, isActive: true },
    });
    if (!supplier) throw new PurchaseReturnSupplierNotFoundException(partyId);
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
    if (!location) throw new PurchaseReturnLocationNotFoundException(id);
    return location;
  }

  private async lockBill(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<PurchaseBillEntity> {
    const bill = await manager
      .getRepository(PurchaseBillEntity)
      .createQueryBuilder('bill')
      .where('bill.organizationId = :organizationId', { organizationId })
      .andWhere('bill.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
    if (!bill) throw new PurchaseReturnSourceBillLineNotFoundException(id);
    return bill;
  }

  private async lockBillLine(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<PurchaseBillLineEntity> {
    const line = await manager
      .getRepository(PurchaseBillLineEntity)
      .createQueryBuilder('line')
      .innerJoinAndSelect('line.bill', 'bill')
      .where('line.organizationId = :organizationId', { organizationId })
      .andWhere('line.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
    if (!line) throw new PurchaseReturnSourceBillLineNotFoundException(id);
    return line;
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
    if (!line) throw new PurchaseReturnSourceReceiptLineNotFoundException(id);
    return line;
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
      throw new PurchaseReturnFiscalYearMissingException();
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
      throw new PurchaseReturnAccountMissingException('BRANCH');
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
