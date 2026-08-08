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
  CreateSalesReturnDto,
  PostSalesReturnDto,
  SalesReturnLineDto,
  SalesReturnQueryDto,
  UpdateSalesReturnDto,
} from './dto/sales-return.dto';
import { SalesInvoiceEntity } from './entities/sales-invoice.entity';
import { SalesInvoiceLineEntity } from './entities/sales-invoice-line.entity';
import { SalesReturnLineEntity } from './entities/sales-return-line.entity';
import { SalesReturnEntity } from './entities/sales-return.entity';
import {
  SALES_AUDIT_ACTIONS,
  SALES_RETURN_DOCUMENT_TYPE,
  SALES_RETURN_NUMBER_PREFIX,
} from './sales.constants';
import {
  SalesReturnAccountMissingException,
  SalesReturnCustomerMismatchException,
  SalesReturnCustomerNotFoundException,
  SalesReturnFiscalYearMissingException,
  SalesReturnLineIncompleteException,
  SalesReturnLocationNotFoundException,
  SalesReturnNoRemainingException,
  SalesReturnNotDraftException,
  SalesReturnNotFoundException,
  SalesReturnQuantityExceededException,
  SalesReturnSourceInvoiceLineNotFoundException,
  SalesReturnSourceNotPostedException,
  SalesReturnZeroQuantityException,
} from './sales.errors';

const ROUND2 = (n: number): number => Math.round(n * 100) / 100;
const ROUND3 = (n: number): number => Math.round(n * 1000) / 1000;

interface PreparedReturnLine {
  lineNo: number;
  sourceSalesInvoiceLineId: string;
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
  lineTotal: number;
  cogsUnitCost: number;
}

interface PreparedReturn {
  lines: PreparedReturnLine[];
  taxableTotal: number;
  nonTaxableTotal: number;
  subtotal: number;
  taxTotal: number;
  cogsTotal: number;
  total: number;
}

@Injectable()
export class SalesReturnService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(SalesReturnEntity)
    private readonly returnRepo: Repository<SalesReturnEntity>,
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
    dto: CreateSalesReturnDto,
  ): Promise<SalesReturnEntity> {
    return this.dataSource.transaction((manager) =>
      this.createDraftIn(manager, organizationId, actorId, dto),
    );
  }

  /**
   * Manager-scoped draft creation (runs inside the caller's transaction).
   * The dispatch engine calls this when a failed stop returns stock to the
   * source location; the draft is posted by the dispatcher via the normal
   * flow. The caller is already authorized via `dispatch.dispatch.update`.
   */
  async createDraftIn(
    manager: EntityManager,
    organizationId: string,
    actorId: string,
    dto: CreateSalesReturnDto,
    opts: { dispatchStopId?: string } = {},
  ): Promise<SalesReturnEntity> {
    const customer = await this.requireCustomer(
      manager,
      organizationId,
      dto.partyId,
    );
    const prepared = await this.prepareReturn(
      manager,
      organizationId,
      customer.id,
      dto.lines,
    );

    const returnRepo = manager.getRepository(SalesReturnEntity);
    const salesReturn = await returnRepo.save(
      returnRepo.create({
        organizationId,
        branchId: dto.branchId ?? null,
        returnNumber: null,
        partyId: customer.id,
        status: 'DRAFT',
        inventoryLocationId: null,
        dispatchStopId: opts.dispatchStopId ?? null,
        taxableTotal: prepared.taxableTotal.toFixed(2),
        nonTaxableTotal: prepared.nonTaxableTotal.toFixed(2),
        subtotal: prepared.subtotal.toFixed(2),
        discountTotal: '0.00',
        taxTotal: prepared.taxTotal.toFixed(2),
        cogsTotal: prepared.cogsTotal.toFixed(2),
        total: prepared.total.toFixed(2),
        returnReason: dto.returnReason ?? null,
        notes: dto.notes ?? null,
      }),
    );

    await this.saveLines(
      manager,
      organizationId,
      salesReturn.id,
      prepared.lines,
    );

    await this.audit.record(
      {
        organizationId,
        branchId: salesReturn.branchId,
        userId: actorId,
        action: SALES_AUDIT_ACTIONS.RETURN_CREATE,
        entityType: 'sales_return',
        entityId: salesReturn.id,
        newData: {
          status: 'DRAFT',
          partyId: customer.id,
          total: prepared.total.toFixed(2),
          lineCount: prepared.lines.length,
          dispatchStopId: opts.dispatchStopId ?? null,
        },
      },
      manager,
    );

    return this.buildReturnView(manager, organizationId, salesReturn.id);
  }

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateSalesReturnDto,
  ): Promise<SalesReturnEntity> {
    return this.dataSource.transaction(async (manager) => {
      const salesReturn = await this.requireReturn(manager, organizationId, id);
      if (salesReturn.status !== 'DRAFT') {
        throw new SalesReturnNotDraftException(
          id,
          salesReturn.status,
          'update',
        );
      }

      if (dto.partyId !== undefined && dto.partyId !== salesReturn.partyId) {
        const customer = await this.requireCustomer(
          manager,
          organizationId,
          dto.partyId,
        );
        salesReturn.partyId = customer.id;
      }
      if (dto.branchId !== undefined) salesReturn.branchId = dto.branchId;
      if (dto.returnReason !== undefined)
        salesReturn.returnReason = dto.returnReason;
      if (dto.notes !== undefined) salesReturn.notes = dto.notes;

      const effectiveLines =
        dto.lines ?? (await this.toLineDtos(manager, salesReturn));
      const prepared = await this.prepareReturn(
        manager,
        organizationId,
        salesReturn.partyId,
        effectiveLines,
      );

      salesReturn.taxableTotal = prepared.taxableTotal.toFixed(2);
      salesReturn.nonTaxableTotal = prepared.nonTaxableTotal.toFixed(2);
      salesReturn.subtotal = prepared.subtotal.toFixed(2);
      salesReturn.taxTotal = prepared.taxTotal.toFixed(2);
      salesReturn.cogsTotal = prepared.cogsTotal.toFixed(2);
      salesReturn.total = prepared.total.toFixed(2);

      const lineRepo = manager.getRepository(SalesReturnLineEntity);
      await lineRepo.delete({ returnId: salesReturn.id });
      await this.saveLines(
        manager,
        organizationId,
        salesReturn.id,
        prepared.lines,
      );
      await manager.getRepository(SalesReturnEntity).save(salesReturn);

      await this.audit.record(
        {
          organizationId,
          branchId: salesReturn.branchId,
          userId: actorId,
          action: SALES_AUDIT_ACTIONS.RETURN_UPDATE,
          entityType: 'sales_return',
          entityId: salesReturn.id,
          newData: {
            status: 'DRAFT',
            partyId: salesReturn.partyId,
            total: salesReturn.total,
            lineCount: prepared.lines.length,
          },
        },
        manager,
      );

      return this.buildReturnView(manager, organizationId, salesReturn.id);
    });
  }

  /**
   * Posts a draft: reserves the `CN-` number, posts the reverse
   * Sales/VAT/AR journal and the Inventory/COGS restoration, re-enters stock
   * for every line at the invoiced cost, and stamps `returned_quantity` on
   * the source lines — all in one transaction. Source lines are re-validated
   * FOR UPDATE so concurrent returns can never over-return, and each affected
   * invoice's `balance_amount` is locked and decremented so a concurrent
   * receipt can never collect against returned amount.
   */
  async post(
    organizationId: string,
    actorId: string,
    id: string,
    dto: PostSalesReturnDto,
  ): Promise<SalesReturnEntity> {
    const postedId = await this.dataSource.transaction(async (manager) => {
      const salesReturn = await this.requireReturn(manager, organizationId, id);
      if (salesReturn.status !== 'DRAFT') {
        throw new SalesReturnNotDraftException(id, salesReturn.status, 'post');
      }
      await this.assertCustomerActive(
        manager,
        organizationId,
        salesReturn.partyId,
      );
      await this.requireLocation(
        manager,
        organizationId,
        dto.inventoryLocationId,
      );

      const lines = await manager.getRepository(SalesReturnLineEntity).find({
        where: { returnId: salesReturn.id },
        order: { lineNo: 'ASC' },
      });

      // Re-validate every source line against its live row (locked FOR
      // UPDATE) and accumulate the returned-quantity stamps.
      const invoiceStamps: Array<{
        line: SalesInvoiceLineEntity;
        baseQuantity: number;
      }> = [];
      // Invoice id → AR reduced by this return (full invoice total, per line
      // source invoice).
      const invoiceBalanceReductions = new Map<string, number>();
      for (const line of lines) {
        const invoiceLine = await this.lockInvoiceLine(
          manager,
          organizationId,
          line.sourceSalesInvoiceLineId,
        );
        if (invoiceLine.invoice.status !== 'POSTED') {
          throw new SalesReturnSourceNotPostedException(invoiceLine.invoiceId);
        }
        if (invoiceLine.invoice.partyId !== salesReturn.partyId) {
          throw new SalesReturnCustomerMismatchException(invoiceLine.id);
        }
        const remaining = ROUND3(
          Number(invoiceLine.baseQuantity) -
            Number(invoiceLine.returnedQuantity),
        );
        if (remaining <= 0) {
          throw new SalesReturnNoRemainingException(invoiceLine.id);
        }
        if (ROUND3(Number(line.baseQuantity)) > remaining) {
          throw new SalesReturnQuantityExceededException(
            invoiceLine.id,
            remaining.toFixed(3),
          );
        }
        invoiceStamps.push({
          line: invoiceLine,
          baseQuantity: Number(line.baseQuantity),
        });
        invoiceBalanceReductions.set(
          invoiceLine.invoiceId,
          (invoiceBalanceReductions.get(invoiceLine.invoiceId) ?? 0) +
            Number(line.lineTotal),
        );
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
          branchId: salesReturn.branchId,
          fiscalYearId: fiscalYear.id,
          documentType: SALES_RETURN_DOCUMENT_TYPE,
          prefix: SALES_RETURN_NUMBER_PREFIX,
        },
        manager,
      );

      const journal = await this.journalFor(
        manager,
        organizationId,
        salesReturn,
      );
      const journalBranchId =
        salesReturn.branchId ??
        (await this.requireDefaultBranch(manager, organizationId));
      const entry = await this.journalService.createDraftIn(
        manager,
        organizationId,
        {
          branchId: journalBranchId,
          entryDate: today.toISOString().slice(0, 10),
          description: `Sales return ${returnNumber}`,
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
        sourceType: 'sales_return',
        sourceId: salesReturn.id,
      });

      const inventoryTxn = await this.inventoryService.receiveForSalesReturn(
        manager,
        organizationId,
        {
          locationId: dto.inventoryLocationId,
          returnId: salesReturn.id,
          notes: `Sales return ${returnNumber}`,
          lines: lines.map((line) => ({
            itemId: line.itemId,
            uomId: line.uomId,
            baseQuantity: Number(line.baseQuantity),
            value: ROUND2(
              Number(line.baseQuantity) * Number(line.cogsUnitCost),
            ),
          })),
        },
        actorId,
      );

      const invoiceLineRepo = manager.getRepository(SalesInvoiceLineEntity);
      for (const stamp of invoiceStamps) {
        await invoiceLineRepo.update(
          { id: stamp.line.id },
          {
            returnedQuantity: ROUND3(
              Number(stamp.line.returnedQuantity) + stamp.baseQuantity,
            ).toFixed(3),
          },
        );
      }

      // Decrement each affected invoice's outstanding AR (balance_amount). The
      // invoice rows lock FOR UPDATE so a concurrent receipt serializes on the
      // same row and can never collect against the returned amount.
      const invoiceRepo = manager.getRepository(SalesInvoiceEntity);
      for (const [invoiceId, reduction] of invoiceBalanceReductions) {
        const invoice = await this.lockInvoice(
          manager,
          organizationId,
          invoiceId,
        );
        await invoiceRepo.update(
          { id: invoice.id },
          {
            balanceAmount: ROUND2(
              Number(invoice.balanceAmount) - reduction,
            ).toFixed(2),
          },
        );
      }

      salesReturn.status = 'POSTED';
      salesReturn.returnNumber = returnNumber;
      salesReturn.returnDate = today.toISOString().slice(0, 10);
      salesReturn.returnDateBs = todayBs;
      salesReturn.fiscalYearId = fiscalYear.id;
      salesReturn.inventoryLocationId = dto.inventoryLocationId;
      salesReturn.journalEntryId = entry.id;
      salesReturn.inventoryTransactionId = inventoryTxn.id;
      await manager.getRepository(SalesReturnEntity).save(salesReturn);

      await this.audit.record(
        {
          organizationId,
          branchId: salesReturn.branchId,
          userId: actorId,
          action: SALES_AUDIT_ACTIONS.RETURN_POST,
          entityType: 'sales_return',
          entityId: salesReturn.id,
          newData: {
            returnNumber,
            status: 'POSTED',
            journalEntryId: entry.id,
            inventoryTransactionId: inventoryTxn.id,
            locationId: dto.inventoryLocationId,
            total: salesReturn.total,
            cogsTotal: salesReturn.cogsTotal,
            lineCount: lines.length,
          },
        },
        manager,
      );

      return salesReturn.id;
    });

    return this.get(organizationId, postedId);
  }

  async voidReturn(
    organizationId: string,
    actorId: string,
    id: string,
  ): Promise<SalesReturnEntity> {
    return this.dataSource.transaction(async (manager) => {
      const salesReturn = await this.requireReturn(manager, organizationId, id);
      if (salesReturn.status !== 'DRAFT') {
        throw new SalesReturnNotDraftException(id, salesReturn.status, 'void');
      }

      salesReturn.status = 'CANCELLED';
      await manager.getRepository(SalesReturnEntity).save(salesReturn);
      await this.audit.record(
        {
          organizationId,
          branchId: salesReturn.branchId,
          userId: actorId,
          action: SALES_AUDIT_ACTIONS.RETURN_VOID,
          entityType: 'sales_return',
          entityId: salesReturn.id,
          newData: { status: 'CANCELLED' },
        },
        manager,
      );

      return this.buildReturnView(manager, organizationId, salesReturn.id);
    });
  }

  // ---- Reads --------------------------------------------------------------

  async get(organizationId: string, id: string): Promise<SalesReturnEntity> {
    return this.buildReturnView(this.dataSource.manager, organizationId, id);
  }

  async list(
    organizationId: string,
    query: SalesReturnQueryDto,
  ): Promise<[SalesReturnEntity[], number]> {
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
    lines: SalesReturnLineDto[],
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
    let cogsTotal = 0;
    for (const line of prepared) {
      subtotal += line.grossAmount;
      if (line.taxRate > 0) taxableTotal += line.taxableAmount;
      else nonTaxableTotal += line.grossAmount;
      taxTotal += line.taxAmount;
      cogsTotal += ROUND2(line.baseQuantity * line.cogsUnitCost);
    }

    return {
      lines: prepared,
      taxableTotal: ROUND2(taxableTotal),
      nonTaxableTotal: ROUND2(nonTaxableTotal),
      subtotal: ROUND2(subtotal),
      taxTotal: ROUND2(taxTotal),
      cogsTotal: ROUND2(cogsTotal),
      total: ROUND2(subtotal + taxTotal),
    };
  }

  /**
   * Invoice-sourced line: reverses the invoice line's snapshotted price/tax
   * (a credit note reverses the original transaction at full price, decision
   * 43). Only `base_quantity − returned_quantity` can ever be returned, and
   * the COGS unit cost snapshot drives the stock re-entry.
   */
  private async prepareInvoiceSourcedLine(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
    lineNo: number,
    sourceId: string,
    quantityOverride: number | undefined,
  ): Promise<PreparedReturnLine> {
    const invoiceLine = await manager
      .getRepository(SalesInvoiceLineEntity)
      .findOne({
        where: { id: sourceId, organizationId },
        relations: { invoice: true },
      });
    if (!invoiceLine)
      throw new SalesReturnSourceInvoiceLineNotFoundException(sourceId);
    if (invoiceLine.invoice.status !== 'POSTED') {
      throw new SalesReturnSourceNotPostedException(invoiceLine.invoiceId);
    }
    if (invoiceLine.invoice.partyId !== partyId) {
      throw new SalesReturnCustomerMismatchException(invoiceLine.id);
    }

    const remaining = ROUND3(
      Number(invoiceLine.baseQuantity) - Number(invoiceLine.returnedQuantity),
    );
    if (remaining <= 0) {
      throw new SalesReturnNoRemainingException(invoiceLine.id);
    }
    const quantity =
      quantityOverride ??
      this.defaultReturnQuantity(
        invoiceLine.quantity,
        remaining,
        invoiceLine.baseQuantity,
      );

    const baseQuantity = ROUND3(
      quantity *
        (Number(invoiceLine.baseQuantity) / Number(invoiceLine.quantity)),
    );
    if (ROUND3(baseQuantity) > remaining) {
      throw new SalesReturnQuantityExceededException(
        invoiceLine.id,
        remaining.toFixed(3),
      );
    }

    const unitPrice = Number(invoiceLine.unitPrice);
    const grossAmount = ROUND2(quantity * unitPrice);
    const taxRate = Number(invoiceLine.taxRate);
    const taxableAmount = grossAmount;
    const taxAmount = ROUND2(taxableAmount * (taxRate / 100));

    return {
      lineNo,
      sourceSalesInvoiceLineId: invoiceLine.id,
      itemId: invoiceLine.itemId,
      uomId: invoiceLine.uomId,
      quantity: ROUND3(quantity),
      baseQuantity,
      unitPrice,
      grossAmount,
      taxCodeId: invoiceLine.taxCodeId,
      irdCategory: invoiceLine.irdCategory,
      taxRate,
      taxableAmount,
      taxAmount,
      lineTotal: ROUND2(taxableAmount + taxAmount),
      cogsUnitCost: Number(invoiceLine.cogsUnitCost ?? 0),
    };
  }

  private async prepareLine(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
    lineNo: number,
    dtoLine: SalesReturnLineDto,
  ): Promise<PreparedReturnLine> {
    if (!dtoLine.sourceSalesInvoiceLineId) {
      throw new SalesReturnLineIncompleteException(lineNo - 1);
    }
    if (dtoLine.quantity !== undefined && dtoLine.quantity <= 0) {
      throw new SalesReturnZeroQuantityException();
    }
    return this.prepareInvoiceSourcedLine(
      manager,
      organizationId,
      partyId,
      lineNo,
      dtoLine.sourceSalesInvoiceLineId,
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
   * Balanced reverse journal for a credit note — the mirror of the invoice
   * entry (decision 43):
   *   CR Accounts Receivable 1103 (total, with the customer party)
   *   DR Sales 4000 (Σ returned gross — revenue reversed)
   *   DR VAT Payable 2111 (Σ output VAT reversed)
   *   DR Inventory 1104 / CR COGS 5000 (Σ base × cogs_unit_cost — the
   *     stock-out restoration, unwinding the invoice's COGS reweight).
   */
  private async journalFor(
    manager: EntityManager,
    organizationId: string,
    salesReturn: SalesReturnEntity,
  ): Promise<
    Array<{
      accountId: string;
      partyId?: string;
      debit?: number;
      credit?: number;
      description?: string;
    }>
  > {
    const ar = await this.requirePurposeAccount(
      manager,
      organizationId,
      'ACCOUNTS_RECEIVABLE',
    );
    const sales = await this.requirePurposeAccount(
      manager,
      organizationId,
      'SALES',
    );

    const total = Number(salesReturn.total);
    const taxTotal = Number(salesReturn.taxTotal);
    const cogsTotal = Number(salesReturn.cogsTotal);
    const salesAmount = ROUND2(total - taxTotal);

    const lines: Array<{
      accountId: string;
      partyId?: string;
      debit?: number;
      credit?: number;
      description?: string;
    }> = [
      {
        accountId: ar.id,
        partyId: salesReturn.partyId,
        credit: total,
        description: `Credit note ${salesReturn.returnNumber ?? ''}`.trim(),
      },
      {
        accountId: sales.id,
        debit: salesAmount,
        description: 'Sales reversed',
      },
    ];
    if (taxTotal > 0) {
      const vatPayable = await this.requirePurposeAccount(
        manager,
        organizationId,
        'TAX_PAYABLE',
      );
      lines.push({
        accountId: vatPayable.id,
        debit: taxTotal,
        description: 'Output VAT reversed',
      });
    }
    if (cogsTotal > 0) {
      const cogs = await this.requirePurposeAccount(
        manager,
        organizationId,
        'COST_OF_GOODS_SOLD',
      );
      const inventory = await this.requirePurposeAccount(
        manager,
        organizationId,
        'INVENTORY',
      );
      lines.push(
        {
          accountId: inventory.id,
          debit: cogsTotal,
          description: 'Inventory in',
        },
        {
          accountId: cogs.id,
          credit: cogsTotal,
          description: 'COGS reversed',
        },
      );
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
      throw new SalesReturnAccountMissingException(purpose);
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
    const lineRepo = manager.getRepository(SalesReturnLineEntity);
    await lineRepo.save(
      lines.map((line) =>
        lineRepo.create({
          organizationId,
          returnId,
          lineNo: line.lineNo,
          sourceSalesInvoiceLineId: line.sourceSalesInvoiceLineId,
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
          lineTotal: line.lineTotal.toFixed(2),
          cogsUnitCost: line.cogsUnitCost.toFixed(2),
        }),
      ),
    );
  }

  private async toLineDtos(
    manager: EntityManager,
    salesReturn: SalesReturnEntity,
  ): Promise<SalesReturnLineDto[]> {
    const lines = await manager.getRepository(SalesReturnLineEntity).find({
      where: { returnId: salesReturn.id },
      order: { lineNo: 'ASC' },
    });
    return lines.map((line) => ({
      sourceSalesInvoiceLineId: line.sourceSalesInvoiceLineId,
      quantity: Number(line.quantity),
    }));
  }

  private async requireReturn(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<SalesReturnEntity> {
    const salesReturn = await manager.getRepository(SalesReturnEntity).findOne({
      where: { id, organizationId },
      relations: { party: true },
    });
    if (!salesReturn) throw new SalesReturnNotFoundException(id);
    return salesReturn;
  }

  private async buildReturnView(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<SalesReturnEntity> {
    const salesReturn = await manager.getRepository(SalesReturnEntity).findOne({
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
    if (!salesReturn) throw new SalesReturnNotFoundException(id);
    salesReturn.lines = await manager
      .getRepository(SalesReturnLineEntity)
      .find({
        where: { returnId: salesReturn.id },
        relations: {
          item: true,
          uom: true,
          taxCode: true,
          sourceInvoiceLine: true,
        },
        order: { lineNo: 'ASC' },
      });
    return salesReturn;
  }

  private async requireCustomer(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
  ): Promise<PartyEntity> {
    const customer = await manager.getRepository(PartyEntity).findOne({
      where: { id: partyId, organizationId, isCustomer: true, isActive: true },
    });
    if (!customer) throw new SalesReturnCustomerNotFoundException(partyId);
    return customer;
  }

  private async assertCustomerActive(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
  ): Promise<void> {
    await this.requireCustomer(manager, organizationId, partyId);
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
    if (!location) throw new SalesReturnLocationNotFoundException(id);
    return location;
  }

  private async lockInvoice(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<SalesInvoiceEntity> {
    const invoice = await manager
      .getRepository(SalesInvoiceEntity)
      .createQueryBuilder('invoice')
      .where('invoice.organizationId = :organizationId', { organizationId })
      .andWhere('invoice.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
    if (!invoice) throw new SalesReturnSourceInvoiceLineNotFoundException(id);
    return invoice;
  }

  private async lockInvoiceLine(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<SalesInvoiceLineEntity> {
    const line = await manager
      .getRepository(SalesInvoiceLineEntity)
      .createQueryBuilder('line')
      .innerJoinAndSelect('line.invoice', 'invoice')
      .where('line.organizationId = :organizationId', { organizationId })
      .andWhere('line.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
    if (!line) throw new SalesReturnSourceInvoiceLineNotFoundException(id);
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
      throw new SalesReturnFiscalYearMissingException();
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
      throw new SalesReturnAccountMissingException('BRANCH');
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
