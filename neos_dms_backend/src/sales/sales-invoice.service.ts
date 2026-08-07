import { Inject, Injectable } from '@nestjs/common';
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
import { BranchEntity } from '../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../tenancy/entities/organization.entity';
import { PartyEntity } from '../accounting/entities/party.entity';
import { TaxCodeEntity } from '../accounting/entities/tax-code.entity';
import type { SystemPurpose } from '../accounting/accounting.constants';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { JournalService } from '../accounting/journal.service';
import { AuditService } from '../audit/audit.service';
import { UserEntity } from '../iam/entities/user.entity';
import { InventoryService } from '../inventory/inventory.service';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { PlanLimitService } from '../subscription/plan-limits/plan-limit.service';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { ItemEntity } from '../trading/entities/item.entity';
import { CBMS_INVOICE_CLIENT } from './cbms/cbms-invoice.client';
import type { CbmsInvoiceClient } from './cbms/cbms-invoice.client';
import {
  CreateSalesInvoiceDto,
  PostSalesInvoiceDto,
  SalesInvoiceLineDto,
  SalesInvoiceQueryDto,
  UpdateSalesInvoiceDto,
} from './dto/sales-invoice.dto';
import { SalesInvoiceLineEntity } from './entities/sales-invoice-line.entity';
import { SalesInvoiceEntity } from './entities/sales-invoice.entity';
import { SalesOrderLineEntity } from './entities/sales-order-line.entity';
import { SalesOrderEntity } from './entities/sales-order.entity';
import {
  SALES_INVOICE_AUDIT_ACTIONS,
  SALES_INVOICE_DOCUMENT_TYPE,
} from './sales.constants';
import type { OrderActor } from './sales-order.service';
import {
  SalesInvoiceAccessDeniedException,
  SalesInvoiceAccountMissingException,
  SalesInvoiceDuplicateOrderLineException,
  SalesInvoiceFiscalYearMissingException,
  SalesInvoiceLineOrderMismatchException,
  SalesInvoiceLocationRequiredException,
  SalesInvoiceNotDraftException,
  SalesInvoiceNotFoundException,
  SalesInvoiceOrderNotConfirmableException,
  SalesInvoiceQuantityExceededException,
  SalesInvoiceUomConversionNotFoundException,
  SalesInvoiceZeroQuantityException,
} from './sales.errors';

const ROUND2 = (n: number): number => Math.round(n * 100) / 100;
const ROUND3 = (n: number): number => Math.round(n * 1000) / 1000;

interface PreparedInvoiceLine {
  lineNo: number;
  sourceSalesOrderLineId: string;
  itemId: string;
  uomId: string;
  quantity: number;
  freeQuantity: number;
  baseQuantity: number;
  unitPrice: number;
  discountPercent: number;
  billedGross: number;
  netBeforeHeader: number;
  taxCodeId: string | null;
  irdCategory: string | null;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
  lineTotal: number;
}

interface PreparedInvoice {
  lines: PreparedInvoiceLine[];
  billedGross: number;
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  nonTaxableTotal: number;
  taxTotal: number;
  total: number;
  roundingAdjustment: number;
}

const INVOICABLE_ORDER_STATUSES = ['CONFIRMED', 'COMPLETED'];

@Injectable()
export class SalesInvoiceService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(SalesInvoiceEntity)
    private readonly invoiceRepo: Repository<SalesInvoiceEntity>,
    @InjectRepository(SalesOrderEntity)
    private readonly orderRepo: Repository<SalesOrderEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly orgRepo: Repository<OrganizationEntity>,
    @Inject(CBMS_INVOICE_CLIENT)
    private readonly cbmsClient: CbmsInvoiceClient,
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
    actor: OrderActor,
    dto: CreateSalesInvoiceDto,
  ): Promise<SalesInvoiceEntity> {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.requireOrder(
        manager,
        organizationId,
        dto.salesOrderId,
      );
      this.assertOrderInvoicable(order);
      await this.assertCanAccessInvoice(organizationId, actor, {
        salespersonId: order.salespersonId,
      } as SalesInvoiceEntity);

      const prepared = await this.prepareInvoice(
        manager,
        organizationId,
        order,
        dto.lines,
        dto.discountAmount,
      );
      const buyer = order.party;

      const invoiceRepo = manager.getRepository(SalesInvoiceEntity);
      const invoice = await invoiceRepo.save(
        invoiceRepo.create({
          organizationId,
          branchId: dto.branchId ?? null,
          invoiceNumber: null,
          orderId: order.id,
          partyId: buyer.id,
          salespersonId: order.salespersonId,
          status: 'DRAFT',
          buyerName: buyer.name ?? null,
          buyerAddress: buyer.address ?? null,
          buyerPan: buyer.panNumber ?? null,
          buyerVat: buyer.vatNumber ?? null,
          taxableTotal: prepared.taxableTotal.toFixed(2),
          nonTaxableTotal: prepared.nonTaxableTotal.toFixed(2),
          subtotal: prepared.subtotal.toFixed(2),
          discountTotal: prepared.discountTotal.toFixed(2),
          taxTotal: prepared.taxTotal.toFixed(2),
          roundingAdjustment: prepared.roundingAdjustment.toFixed(2),
          total: prepared.total.toFixed(2),
          excisableAmount: '0.00',
          exciseTotal: '0.00',
          hstTotal: '0.00',
          esfTotal: '0.00',
          exportTotal: '0.00',
          paidAmount: '0.00',
          balanceAmount: prepared.total.toFixed(2),
          cbmsStatus: 'NOT_REQUIRED',
          notes: dto.notes ?? null,
        }),
      );

      const lineRepo = manager.getRepository(SalesInvoiceLineEntity);
      await lineRepo.save(
        prepared.lines.map((line) =>
          lineRepo.create({
            organizationId,
            invoiceId: invoice.id,
            lineNo: line.lineNo,
            sourceSalesOrderLineId: line.sourceSalesOrderLineId,
            itemId: line.itemId,
            uomId: line.uomId,
            quantity: line.quantity.toFixed(3),
            freeQuantity: line.freeQuantity.toFixed(3),
            baseQuantity: line.baseQuantity.toFixed(3),
            unitPrice: line.unitPrice.toFixed(2),
            isTaxInclusive: false,
            grossAmount: line.billedGross.toFixed(2),
            discountPercent: line.discountPercent.toFixed(2),
            discountAmount: ROUND2(
              line.billedGross * (line.discountPercent / 100),
            ).toFixed(2),
            taxCodeId: line.taxCodeId,
            irdCategory: line.irdCategory,
            taxRate: line.taxRate.toFixed(4),
            taxableAmount: line.taxableAmount.toFixed(2),
            taxAmount: line.taxAmount.toFixed(2),
            lineTotal: line.lineTotal.toFixed(2),
          }),
        ),
      );

      await this.audit.record(
        {
          organizationId,
          userId: actor.id,
          action: SALES_INVOICE_AUDIT_ACTIONS.CREATE,
          entityType: 'sales_invoice',
          entityId: invoice.id,
          newData: {
            status: 'DRAFT',
            orderId: order.id,
            partyId: buyer.id,
            total: prepared.total.toFixed(2),
            taxTotal: prepared.taxTotal.toFixed(2),
            lineCount: prepared.lines.length,
          },
        },
        manager,
      );

      return this.buildInvoiceView(manager, organizationId, invoice.id);
    });
  }

  async update(
    organizationId: string,
    actor: OrderActor,
    id: string,
    dto: UpdateSalesInvoiceDto,
  ): Promise<SalesInvoiceEntity> {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await this.requireInvoice(manager, organizationId, id);
      if (invoice.status !== 'DRAFT')
        throw new SalesInvoiceNotDraftException(id, invoice.status, 'update');
      await this.assertCanAccessInvoice(organizationId, actor, invoice);

      const order = await this.requireOrder(
        manager,
        organizationId,
        invoice.orderId,
      );
      this.assertOrderInvoicable(order);

      const effectiveLines =
        dto.lines ?? (await this.toLineDtos(manager, invoice));
      const prepared = await this.prepareInvoice(
        manager,
        organizationId,
        order,
        effectiveLines,
        dto.discountAmount ?? Number(invoice.discountTotal),
      );

      const invoiceRepo = manager.getRepository(SalesInvoiceEntity);
      invoice.subtotal = prepared.subtotal.toFixed(2);
      invoice.discountTotal = prepared.discountTotal.toFixed(2);
      invoice.taxableTotal = prepared.taxableTotal.toFixed(2);
      invoice.nonTaxableTotal = prepared.nonTaxableTotal.toFixed(2);
      invoice.taxTotal = prepared.taxTotal.toFixed(2);
      invoice.roundingAdjustment = prepared.roundingAdjustment.toFixed(2);
      invoice.total = prepared.total.toFixed(2);
      invoice.balanceAmount = prepared.total.toFixed(2);
      if (dto.branchId !== undefined) invoice.branchId = dto.branchId;
      if (dto.notes !== undefined) invoice.notes = dto.notes;
      await invoiceRepo.save(invoice);

      const lineRepo = manager.getRepository(SalesInvoiceLineEntity);
      await lineRepo.delete({ invoiceId: invoice.id });
      await lineRepo.save(
        prepared.lines.map((line) =>
          lineRepo.create({
            organizationId,
            invoiceId: invoice.id,
            lineNo: line.lineNo,
            sourceSalesOrderLineId: line.sourceSalesOrderLineId,
            itemId: line.itemId,
            uomId: line.uomId,
            quantity: line.quantity.toFixed(3),
            freeQuantity: line.freeQuantity.toFixed(3),
            baseQuantity: line.baseQuantity.toFixed(3),
            unitPrice: line.unitPrice.toFixed(2),
            isTaxInclusive: false,
            grossAmount: line.billedGross.toFixed(2),
            discountPercent: line.discountPercent.toFixed(2),
            discountAmount: ROUND2(
              line.billedGross * (line.discountPercent / 100),
            ).toFixed(2),
            taxCodeId: line.taxCodeId,
            irdCategory: line.irdCategory,
            taxRate: line.taxRate.toFixed(4),
            taxableAmount: line.taxableAmount.toFixed(2),
            taxAmount: line.taxAmount.toFixed(2),
            lineTotal: line.lineTotal.toFixed(2),
          }),
        ),
      );

      await this.audit.record(
        {
          organizationId,
          userId: actor.id,
          action: SALES_INVOICE_AUDIT_ACTIONS.UPDATE,
          entityType: 'sales_invoice',
          entityId: invoice.id,
          newData: {
            status: 'DRAFT',
            total: invoice.total,
            discountTotal: invoice.discountTotal,
            lineCount: prepared.lines.length,
          },
        },
        manager,
      );

      return this.buildInvoiceView(manager, organizationId, invoice.id);
    });
  }

  /**
   * Posts a draft: assigns the invoice number, posts AR/VAT journal, issues
   * stock, bumps the order lines' invoiced quantities, and consumes the
   * plan's monthly invoice limit — all in one transaction. CBMS push runs
   * after commit and never blocks issuance.
   */
  async post(
    organizationId: string,
    actor: OrderActor,
    id: string,
    dto: PostSalesInvoiceDto,
  ): Promise<SalesInvoiceEntity> {
    const postedId = await this.dataSource.transaction(async (manager) => {
      const invoice = await this.requireInvoice(manager, organizationId, id);
      if (invoice.status !== 'DRAFT')
        throw new SalesInvoiceNotDraftException(id, invoice.status, 'post');
      await this.assertCanAccessInvoice(organizationId, actor, invoice);

      const order = await this.requireOrder(
        manager,
        organizationId,
        invoice.orderId,
      );
      this.assertOrderInvoicable(order);
      if (!dto.inventoryLocationId)
        throw new SalesInvoiceLocationRequiredException();

      await this.validateStoredLinesRemaining(manager, organizationId, invoice);

      const today = new Date();
      const todayBs = this.toBs(today);
      const fiscalYear = await this.resolveFiscalYear(
        manager,
        organizationId,
        today,
      );

      const invoiceNumber = await this.documentSequenceService.nextNumber(
        {
          organizationId,
          branchId: invoice.branchId,
          fiscalYearId: fiscalYear.id,
          documentType: SALES_INVOICE_DOCUMENT_TYPE,
          prefix: 'INV-',
        },
        manager,
      );

      const dueDays = await this.dueDays(
        manager,
        organizationId,
        invoice.partyId,
      );
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + dueDays);

      const journal = await this.journalFor(manager, organizationId, invoice);
      const journalBranchId =
        invoice.branchId ??
        order.branchId ??
        (await this.requireDefaultBranch(manager, organizationId));
      const entry = await this.journalService.createDraftIn(
        manager,
        organizationId,
        {
          branchId: journalBranchId,
          entryDate: today.toISOString().slice(0, 10),
          description: `Sales invoice ${invoiceNumber}`,
          lines: journal,
        },
        actor.id,
      );
      await this.journalService.postIn(
        manager,
        organizationId,
        entry.id,
        actor.id,
      );

      const lines = await manager.getRepository(SalesInvoiceLineEntity).find({
        where: { invoiceId: invoice.id },
        relations: { sourceOrderLine: { item: true } },
        order: { lineNo: 'ASC' },
      });

      const inventoryTxn = await this.inventoryService.issueForSalesInvoice(
        manager,
        organizationId,
        {
          locationId: dto.inventoryLocationId,
          invoiceId: invoice.id,
          notes: `Sales invoice ${invoiceNumber}`,
          lines: lines.map((line) => ({
            itemId: line.itemId,
            uomId: line.uomId,
            baseQuantity: Number(line.baseQuantity),
            unitCost: Number(line.sourceOrderLine?.item?.standardCost ?? 0),
          })),
        },
        actor.id,
      );

      const orderLineRepo = manager.getRepository(SalesOrderLineEntity);
      const lockedLines = await this.lockOrderLines(
        manager,
        organizationId,
        order.id,
      );
      const lockedById = new Map(lockedLines.map((line) => [line.id, line]));
      for (const line of lines) {
        const orderLine = lockedById.get(line.sourceSalesOrderLineId);
        if (!orderLine) continue;
        orderLine.invoicedQuantity = ROUND3(
          Number(orderLine.invoicedQuantity) + Number(line.quantity),
        ).toFixed(3);
        await orderLineRepo.save(orderLine);
      }

      await this.planLimitService.consumePeriodic(
        organizationId,
        'invoices_per_month',
        manager,
      );

      invoice.status = 'POSTED';
      invoice.invoiceNumber = invoiceNumber;
      invoice.invoiceDate = today.toISOString().slice(0, 10);
      invoice.invoiceDateBs = todayBs;
      invoice.dueDate = dueDate.toISOString().slice(0, 10);
      invoice.dueDateBs = this.toBs(dueDate);
      invoice.fiscalYearId = fiscalYear.id;
      invoice.journalEntryId = entry.id;
      invoice.inventoryTransactionId = inventoryTxn.id;
      await manager.getRepository(SalesInvoiceEntity).save(invoice);

      await this.audit.record(
        {
          organizationId,
          branchId: invoice.branchId,
          userId: actor.id,
          action: SALES_INVOICE_AUDIT_ACTIONS.POST,
          entityType: 'sales_invoice',
          entityId: invoice.id,
          newData: {
            invoiceNumber,
            status: 'POSTED',
            journalEntryId: entry.id,
            inventoryTransactionId: inventoryTxn.id,
            total: invoice.total,
          },
        },
        manager,
      );

      return invoice.id;
    });

    await this.pushToCbms(organizationId, postedId);
    return this.get(organizationId, actor, postedId);
  }

  async voidInvoice(
    organizationId: string,
    actor: OrderActor,
    id: string,
  ): Promise<SalesInvoiceEntity> {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await this.requireInvoice(manager, organizationId, id);
      if (invoice.status !== 'DRAFT')
        throw new SalesInvoiceNotDraftException(id, invoice.status, 'void');
      await this.assertCanAccessInvoice(organizationId, actor, invoice);

      invoice.status = 'CANCELLED';
      await manager.getRepository(SalesInvoiceEntity).save(invoice);
      await this.audit.record(
        {
          organizationId,
          branchId: invoice.branchId,
          userId: actor.id,
          action: SALES_INVOICE_AUDIT_ACTIONS.VOID,
          entityType: 'sales_invoice',
          entityId: invoice.id,
          newData: { status: 'CANCELLED' },
        },
        manager,
      );
      return this.buildInvoiceView(manager, organizationId, invoice.id);
    });
  }

  // ---- Reads --------------------------------------------------------------

  async get(
    organizationId: string,
    actor: OrderActor,
    id: string,
  ): Promise<SalesInvoiceEntity> {
    const invoice = await this.requireInvoice(
      this.dataSource.manager,
      organizationId,
      id,
    );
    await this.assertCanAccessInvoice(organizationId, actor, invoice);
    return this.buildInvoiceView(this.dataSource.manager, organizationId, id);
  }

  async list(
    organizationId: string,
    actor: OrderActor,
    scope: 'mine' | 'team' | 'all',
    query: SalesInvoiceQueryDto,
  ): Promise<[SalesInvoiceEntity[], number]> {
    const qb = this.invoiceRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.party', 'party')
      .leftJoinAndSelect('i.salesperson', 'salesperson')
      .where('i.organization_id = :organizationId', { organizationId });

    if (scope === 'mine') {
      qb.andWhere('i.salesperson_id = :actorId', { actorId: actor.id });
    } else if (scope === 'team') {
      const teamIds = await this.userRepo
        .find({ where: { organizationId, managerId: actor.id } })
        .then((rows) => rows.map((r) => r.id));
      if (teamIds.length === 0) return [[], 0];
      qb.andWhere('i.salesperson_id IN (:...teamIds)', { teamIds });
    }

    if (query.status)
      qb.andWhere('i.status = :status', { status: query.status });
    if (query.partyId)
      qb.andWhere('i.party_id = :partyId', { partyId: query.partyId });
    if (query.salespersonId)
      qb.andWhere('i.salesperson_id = :salespersonId', {
        salespersonId: query.salespersonId,
      });
    if (query.orderId)
      qb.andWhere('i.sales_order_id = :orderId', { orderId: query.orderId });

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('i.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getMany();
    return [rows, total];
  }

  // ---- Preparation --------------------------------------------------------

  /**
   * Validates the requested lines against the order (lock-held) and computes
   * the full invoice totals: per-line discounts, pro-rata header discount
   * (order discount × invoiced subtotal ÷ order subtotal), tax snapshot.
   */
  private async prepareInvoice(
    manager: EntityManager,
    organizationId: string,
    order: SalesOrderEntity,
    dtoLines: SalesInvoiceLineDto[],
    headerDiscountOverride: number | undefined,
  ): Promise<PreparedInvoice> {
    const orderLines = await this.lockOrderLines(
      manager,
      organizationId,
      order.id,
    );
    const orderLinesById = new Map(orderLines.map((line) => [line.id, line]));

    const seen = new Set<string>();
    const prepared: PreparedInvoiceLine[] = [];
    for (const [index, dtoLine] of dtoLines.entries()) {
      const orderLine = orderLinesById.get(dtoLine.orderLineId);
      if (!orderLine)
        throw new SalesInvoiceLineOrderMismatchException(
          dtoLine.orderLineId,
          order.id,
        );
      if (seen.has(dtoLine.orderLineId))
        throw new SalesInvoiceDuplicateOrderLineException(dtoLine.orderLineId);
      seen.add(dtoLine.orderLineId);

      const quantity = dtoLine.quantity;
      if (!quantity || quantity <= 0)
        throw new SalesInvoiceZeroQuantityException();
      const remaining = ROUND3(
        Number(orderLine.quantity) - Number(orderLine.invoicedQuantity),
      );
      if (quantity > remaining) {
        throw new SalesInvoiceQuantityExceededException(
          orderLine.id,
          quantity,
          remaining,
        );
      }

      const billsFullRemaining = ROUND3(remaining - quantity) === 0;
      const freeQuantity =
        dtoLine.freeQuantity ??
        (billsFullRemaining ? Number(orderLine.freeQuantity) : 0);

      const baseQuantity = await this.toBaseQuantity(
        manager,
        organizationId,
        orderLine.item,
        orderLine.uomId,
        quantity + freeQuantity,
      );
      const unitPrice = dtoLine.unitPrice ?? Number(orderLine.unitPrice);
      const discountPercent =
        dtoLine.discountPercent ?? Number(orderLine.discountPercent);

      const billedGross = ROUND2(quantity * unitPrice);
      const netBeforeHeader = ROUND2(billedGross * (1 - discountPercent / 100));

      const tax = await this.resolveTaxCode(
        manager,
        organizationId,
        dtoLine.taxCodeId,
        orderLine.item,
      );

      prepared.push({
        lineNo: index + 1,
        sourceSalesOrderLineId: orderLine.id,
        itemId: orderLine.itemId,
        uomId: orderLine.uomId,
        quantity,
        freeQuantity,
        baseQuantity,
        unitPrice,
        discountPercent,
        billedGross,
        netBeforeHeader,
        taxCodeId: tax.codeId,
        irdCategory: tax.irdCategory,
        taxRate: tax.rate,
        taxableAmount: 0,
        taxAmount: 0,
        lineTotal: 0,
      });
    }

    const billedGross = ROUND2(
      prepared.reduce((sum, line) => sum + line.billedGross, 0),
    );
    const invoiceBilledNet = ROUND2(
      prepared.reduce((sum, line) => sum + line.netBeforeHeader, 0),
    );
    const orderSubtotal = ROUND2(
      orderLines.reduce((sum, line) => sum + Number(line.lineTotal), 0),
    );

    const defaultHeaderDiscount =
      orderSubtotal > 0
        ? ROUND2(
            (Number(order.discountAmount ?? 0) * invoiceBilledNet) /
              orderSubtotal,
          )
        : 0;
    const discountTotal = ROUND2(
      Math.min(
        invoiceBilledNet,
        Math.max(0, headerDiscountOverride ?? defaultHeaderDiscount),
      ),
    );
    const subtotal = ROUND2(invoiceBilledNet - discountTotal);

    let taxableTotal = 0;
    let nonTaxableTotal = 0;
    let taxTotal = 0;
    for (const line of prepared) {
      const discountShare =
        invoiceBilledNet > 0
          ? ROUND2((line.netBeforeHeader / invoiceBilledNet) * discountTotal)
          : 0;
      const netAfterDiscount = ROUND2(line.netBeforeHeader - discountShare);
      const isTaxable = line.taxRate > 0;
      line.taxableAmount = isTaxable ? netAfterDiscount : 0;
      line.taxAmount = isTaxable
        ? ROUND2(netAfterDiscount * (line.taxRate / 100))
        : 0;
      line.lineTotal = ROUND2(netAfterDiscount + line.taxAmount);
      if (isTaxable) taxableTotal += line.taxableAmount;
      else nonTaxableTotal += netAfterDiscount;
      taxTotal += line.taxAmount;
    }
    taxableTotal = ROUND2(taxableTotal);
    nonTaxableTotal = ROUND2(nonTaxableTotal);
    taxTotal = ROUND2(taxTotal);
    const total = ROUND2(subtotal + taxTotal);

    return {
      lines: prepared,
      billedGross,
      subtotal,
      discountTotal,
      taxableTotal,
      nonTaxableTotal,
      taxTotal,
      total,
      roundingAdjustment: ROUND2(total - (subtotal + taxTotal)),
    };
  }

  /** Re-checks a draft's stored lines against the live remaining quantities. */
  private async validateStoredLinesRemaining(
    manager: EntityManager,
    organizationId: string,
    invoice: SalesInvoiceEntity,
  ): Promise<void> {
    const orderLines = await this.lockOrderLines(
      manager,
      organizationId,
      invoice.orderId,
    );
    const byId = new Map(orderLines.map((line) => [line.id, line]));
    const lines = await manager.getRepository(SalesInvoiceLineEntity).find({
      where: { invoiceId: invoice.id },
    });
    for (const line of lines) {
      const orderLine = byId.get(line.sourceSalesOrderLineId);
      if (!orderLine) continue;
      const remaining = ROUND3(
        Number(orderLine.quantity) - Number(orderLine.invoicedQuantity),
      );
      if (Number(line.quantity) > remaining) {
        throw new SalesInvoiceQuantityExceededException(
          orderLine.id,
          Number(line.quantity),
          remaining,
        );
      }
    }
  }

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
    return {
      codeId: code.id,
      irdCategory: code.irdCategory,
      rate: Number(code.rate),
    };
  }

  private async journalFor(
    manager: EntityManager,
    organizationId: string,
    invoice: SalesInvoiceEntity,
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
    const vatPayable = await this.requirePurposeAccount(
      manager,
      organizationId,
      'TAX_PAYABLE',
    );

    const discountTotal = Number(invoice.discountTotal);
    const total = Number(invoice.total);
    const taxTotal = Number(invoice.taxTotal);
    const salesAmount = ROUND2(Number(invoice.subtotal) + discountTotal);

    const lines: Array<{
      accountId: string;
      partyId?: string;
      debit?: number;
      credit?: number;
      description?: string;
    }> = [
      {
        accountId: ar.id,
        partyId: invoice.partyId,
        debit: total,
        description: `Receivable ${invoice.invoiceNumber ?? ''}`.trim(),
      },
      {
        accountId: sales.id,
        credit: salesAmount,
        description: 'Sales revenue',
      },
    ];
    if (discountTotal > 0) {
      const discounts = await this.requirePurposeAccount(
        manager,
        organizationId,
        'DISCOUNT_ALLOWED',
      );
      lines.push({
        accountId: discounts.id,
        debit: discountTotal,
        description: 'Sales discounts',
      });
    }
    if (taxTotal > 0) {
      lines.push({
        accountId: vatPayable.id,
        credit: taxTotal,
        description: 'Output VAT',
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
      throw new SalesInvoiceAccountMissingException(purpose);
    }
    return account;
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
      throw new SalesInvoiceFiscalYearMissingException();
    }
    return fiscalYear;
  }

  private async dueDays(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
  ): Promise<number> {
    const party = await manager.getRepository(PartyEntity).findOne({
      where: { id: partyId, organizationId },
      relations: { paymentTerm: true },
    });
    return party?.paymentTerm?.dueDays ?? 0;
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
      throw new SalesInvoiceAccountMissingException('BRANCH');
    }
    return branch.id;
  }

  // ---- CBMS ---------------------------------------------------------------

  private async pushToCbms(
    organizationId: string,
    invoiceId: string,
  ): Promise<void> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, organizationId },
      relations: { party: true, order: true },
    });
    if (!invoice || invoice.status !== 'POSTED' || !invoice.invoiceNumber) {
      return;
    }

    const org = await this.orgRepo.findOne({ where: { id: organizationId } });
    const bsYear = invoice.invoiceDateBs
      ? parseInt(invoice.invoiceDateBs.split('-')[0], 10)
      : new Date().getFullYear();

    let result: {
      pushed: boolean;
      reference?: string | null;
      skipped?: boolean;
      error?: string | null;
    };
    try {
      result = await this.cbmsClient.pushInvoice({
        sellerPan: org?.panNumber ?? '',
        buyerPan: invoice.buyerPan ?? '',
        buyerName: invoice.buyerName ?? '',
        fiscalYear: `${bsYear}/${String(bsYear + 1).slice(2)}`,
        refInvoiceNumber: invoice.invoiceNumber,
        totalSales: Number(invoice.total),
        taxableSalesVat: Number(invoice.taxableTotal),
        vat: Number(invoice.taxTotal),
        excisableAmount: Number(invoice.excisableAmount),
        excise: Number(invoice.exciseTotal),
        taxableSalesHst: 0,
        hst: 0,
        amountForEsf: 0,
        esf: 0,
        exportSales: Number(invoice.exportTotal),
        taxExemptedSales: Number(invoice.nonTaxableTotal),
        isRealtime: true,
        datetimeClient: new Date().toISOString(),
      });
    } catch (error) {
      result = {
        pushed: false,
        skipped: false,
        error: error instanceof Error ? error.message : 'CBMS push failed',
      };
    }

    if (result.skipped) {
      await this.invoiceRepo.update(invoiceId, {
        cbmsStatus: 'NOT_REQUIRED',
        cbmsError: null,
      });
    } else if (result.pushed) {
      await this.invoiceRepo.update(invoiceId, {
        cbmsStatus: 'PUSHED',
        cbmsReference: result.reference ?? null,
        cbmsError: null,
      });
    } else {
      await this.invoiceRepo.update(invoiceId, {
        cbmsStatus: 'FAILED',
        cbmsReference: null,
        cbmsError: result.error ?? 'CBMS push failed',
      });
    }
  }

  // ---- Shared -------------------------------------------------------------

  private async requireOrder(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<SalesOrderEntity> {
    const order = await manager.getRepository(SalesOrderEntity).findOne({
      where: { id, organizationId },
      relations: { party: true, salesperson: true },
    });
    if (!order) throw new SalesInvoiceNotFoundException(id);
    return order;
  }

  private async requireInvoice(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<SalesInvoiceEntity> {
    const invoice = await manager.getRepository(SalesInvoiceEntity).findOne({
      where: { id, organizationId },
      relations: { party: true, salesperson: true, order: true },
    });
    if (!invoice) throw new SalesInvoiceNotFoundException(id);
    return invoice;
  }

  private async buildInvoiceView(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<SalesInvoiceEntity> {
    const invoice = await manager.getRepository(SalesInvoiceEntity).findOne({
      where: { id, organizationId },
      relations: {
        party: true,
        salesperson: true,
        order: true,
        fiscalYear: true,
        journalEntry: true,
        inventoryTransaction: { location: true },
      },
    });
    if (!invoice) throw new SalesInvoiceNotFoundException(id);
    invoice.lines = await manager.getRepository(SalesInvoiceLineEntity).find({
      where: { invoiceId: invoice.id },
      relations: {
        item: true,
        uom: true,
        taxCode: true,
        sourceOrderLine: true,
      },
      order: { lineNo: 'ASC' },
    });
    return invoice;
  }

  private async lockOrderLines(
    manager: EntityManager,
    organizationId: string,
    orderId: string,
  ): Promise<SalesOrderLineEntity[]> {
    return manager
      .getRepository(SalesOrderLineEntity)
      .createQueryBuilder('line')
      .leftJoinAndSelect('line.item', 'item')
      .where('line.organizationId = :organizationId', { organizationId })
      .andWhere('line.orderId = :orderId', { orderId })
      .setLock('pessimistic_write', undefined, ['line'])
      .getMany();
  }

  /** Converts stored draft lines back to DTOs for re-preparation on update. */
  private async toLineDtos(
    manager: EntityManager,
    invoice: SalesInvoiceEntity,
  ): Promise<SalesInvoiceLineDto[]> {
    const lines = await manager.getRepository(SalesInvoiceLineEntity).find({
      where: { invoiceId: invoice.id },
      order: { lineNo: 'ASC' },
    });
    return lines.map((line) => ({
      orderLineId: line.sourceSalesOrderLineId,
      quantity: Number(line.quantity),
      freeQuantity: Number(line.freeQuantity),
      unitPrice: Number(line.unitPrice),
      discountPercent: Number(line.discountPercent),
      taxCodeId: line.taxCodeId ?? undefined,
    }));
  }

  /** Converts a quantity in `uomId` to the item's base uom (same rule as order/inventory). */
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
      throw new SalesInvoiceUomConversionNotFoundException(
        uomId,
        item.baseUomId,
        item.id,
      );

    return ROUND3(Number(quantity) * Number(conversion.conversionFactor));
  }

  private assertOrderInvoicable(order: SalesOrderEntity): void {
    if (!INVOICABLE_ORDER_STATUSES.includes(order.status)) {
      throw new SalesInvoiceOrderNotConfirmableException(
        order.id,
        order.status,
      );
    }
  }

  private assertCanAccessInvoice(
    organizationId: string,
    actor: OrderActor,
    invoice: SalesInvoiceEntity,
  ): Promise<void> {
    return this.assertCanAccess(organizationId, actor, invoice.salespersonId);
  }

  /** Own document, or admin, or manager of the salesperson. */
  private async assertCanAccess(
    organizationId: string,
    actor: OrderActor,
    salespersonId: string,
  ): Promise<void> {
    if (salespersonId === actor.id) return;
    if (actor.roleCode === 'admin') return;
    const salesperson = await this.userRepo.findOne({
      where: { id: salespersonId, organizationId },
    });
    if (salesperson && salesperson.managerId === actor.id) return;
    throw new SalesInvoiceAccessDeniedException();
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
