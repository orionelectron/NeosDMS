import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { FiscalYearEntity } from '../accounting/entities/fiscal-year.entity';
import { PartyEntity } from '../accounting/entities/party.entity';
import { AuditService } from '../audit/audit.service';
import { InventoryLocationEntity } from '../inventory/entities/inventory-location.entity';
import { InventoryService } from '../inventory/inventory.service';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { PlanLimitService } from '../subscription/plan-limits/plan-limit.service';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { UomEntity } from '../trading/entities/uom.entity';
import {
  CreatePurchaseReceiptDto,
  PurchaseReceiptLineDto,
  PurchaseReceiptQueryDto,
  UpdatePurchaseReceiptDto,
} from './dto/purchase-receipt.dto';
import { PurchaseReceiptLineEntity } from './entities/purchase-receipt-line.entity';
import { PurchaseReceiptEntity } from './entities/purchase-receipt.entity';
import {
  PURCHASE_AUDIT_ACTIONS,
  PURCHASE_RECEIPT_DOCUMENT_TYPE,
  PURCHASE_RECEIPT_NUMBER_PREFIX,
} from './purchase.constants';
import {
  PurchaseReceiptFiscalYearMissingException,
  PurchaseReceiptItemNotFoundException,
  PurchaseReceiptItemNotTrackedException,
  PurchaseReceiptLocationNotFoundException,
  PurchaseReceiptNotDraftException,
  PurchaseReceiptNotFoundException,
  PurchaseReceiptSupplierNotFoundException,
  PurchaseReceiptUomConversionNotFoundException,
  PurchaseReceiptUomNotFoundException,
  PurchaseReceiptZeroQuantityException,
} from './purchase.errors';

const ROUND3 = (n: number): number => Math.round(n * 1000) / 1000;

interface PreparedLine {
  lineNo: number;
  itemId: string;
  uomId: string;
  quantity: number;
  baseQuantity: number;
  unitCost: number;
}

@Injectable()
export class PurchaseReceiptService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(PurchaseReceiptEntity)
    private readonly receiptRepo: Repository<PurchaseReceiptEntity>,
    private readonly audit: AuditService,
    private readonly documentSequenceService: DocumentSequenceService,
    private readonly inventoryService: InventoryService,
    private readonly planLimitService: PlanLimitService,
    private readonly nepaliDate: NepaliDateConverter,
  ) {}

  // ---- Mutations ----------------------------------------------------------

  async create(
    organizationId: string,
    actorId: string,
    dto: CreatePurchaseReceiptDto,
  ): Promise<PurchaseReceiptEntity> {
    return this.dataSource.transaction(async (manager) => {
      const supplier = await this.requireSupplier(
        manager,
        organizationId,
        dto.partyId,
      );
      await this.requireLocation(
        manager,
        organizationId,
        dto.inventoryLocationId,
      );
      const prepared = await this.prepareLines(
        manager,
        organizationId,
        dto.lines,
      );

      const receiptRepo = manager.getRepository(PurchaseReceiptEntity);
      const receipt = await receiptRepo.save(
        receiptRepo.create({
          organizationId,
          branchId: dto.branchId ?? null,
          receiptNumber: null,
          partyId: supplier.id,
          status: 'DRAFT',
          inventoryLocationId: dto.inventoryLocationId,
          notes: dto.notes ?? null,
        }),
      );

      await this.saveLines(manager, organizationId, receipt.id, prepared);

      await this.audit.record(
        {
          organizationId,
          branchId: receipt.branchId,
          userId: actorId,
          action: PURCHASE_AUDIT_ACTIONS.RECEIPT_CREATE,
          entityType: 'purchase_receipt',
          entityId: receipt.id,
          newData: {
            status: 'DRAFT',
            partyId: supplier.id,
            inventoryLocationId: dto.inventoryLocationId,
            lineCount: prepared.length,
          },
        },
        manager,
      );

      return this.buildReceiptView(manager, organizationId, receipt.id);
    });
  }

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdatePurchaseReceiptDto,
  ): Promise<PurchaseReceiptEntity> {
    return this.dataSource.transaction(async (manager) => {
      const receipt = await this.requireReceipt(manager, organizationId, id);
      if (receipt.status !== 'DRAFT') {
        throw new PurchaseReceiptNotDraftException(
          id,
          receipt.status,
          'update',
        );
      }

      if (dto.partyId !== undefined && dto.partyId !== receipt.partyId) {
        const supplier = await this.requireSupplier(
          manager,
          organizationId,
          dto.partyId,
        );
        receipt.partyId = supplier.id;
      }
      if (dto.inventoryLocationId !== undefined) {
        await this.requireLocation(
          manager,
          organizationId,
          dto.inventoryLocationId,
        );
        receipt.inventoryLocationId = dto.inventoryLocationId;
      }
      if (dto.branchId !== undefined) receipt.branchId = dto.branchId;
      if (dto.notes !== undefined) receipt.notes = dto.notes;

      if (dto.lines !== undefined) {
        const prepared = await this.prepareLines(
          manager,
          organizationId,
          dto.lines,
        );
        const lineRepo = manager.getRepository(PurchaseReceiptLineEntity);
        await lineRepo.delete({ receiptId: receipt.id });
        await this.saveLines(manager, organizationId, receipt.id, prepared);
      }

      await manager.getRepository(PurchaseReceiptEntity).save(receipt);
      await this.audit.record(
        {
          organizationId,
          branchId: receipt.branchId,
          userId: actorId,
          action: PURCHASE_AUDIT_ACTIONS.RECEIPT_UPDATE,
          entityType: 'purchase_receipt',
          entityId: receipt.id,
          newData: {
            status: 'DRAFT',
            partyId: receipt.partyId,
            inventoryLocationId: receipt.inventoryLocationId,
          },
        },
        manager,
      );

      return this.buildReceiptView(manager, organizationId, receipt.id);
    });
  }

  /**
   * Posts a draft: reserves the GRN number, creates the quantity-only
   * `purchase_receipt` (IN) inventory transaction, and consumes the plan's
   * monthly `purchase_receipts_per_month` quota — all in one transaction. No
   * journal (decision 42): value enters inventory on the purchase bill.
   */
  async post(
    organizationId: string,
    actorId: string,
    id: string,
  ): Promise<PurchaseReceiptEntity> {
    const postedId = await this.dataSource.transaction(async (manager) => {
      const receipt = await this.requireReceipt(manager, organizationId, id);
      if (receipt.status !== 'DRAFT') {
        throw new PurchaseReceiptNotDraftException(id, receipt.status, 'post');
      }
      await this.assertSupplierActive(manager, organizationId, receipt.partyId);

      const lines = await manager
        .getRepository(PurchaseReceiptLineEntity)
        .find({
          where: { receiptId: receipt.id },
          order: { lineNo: 'ASC' },
        });
      for (const line of lines) {
        if (Number(line.baseQuantity) <= 0) {
          throw new PurchaseReceiptZeroQuantityException();
        }
      }

      const today = new Date();
      const todayBs = this.toBs(today);
      const fiscalYear = await this.resolveFiscalYear(
        manager,
        organizationId,
        today,
      );

      const receiptNumber = await this.documentSequenceService.nextNumber(
        {
          organizationId,
          branchId: receipt.branchId,
          fiscalYearId: fiscalYear.id,
          documentType: PURCHASE_RECEIPT_DOCUMENT_TYPE,
          prefix: PURCHASE_RECEIPT_NUMBER_PREFIX,
        },
        manager,
      );

      const inventoryTxn =
        await this.inventoryService.receiveForPurchaseReceipt(
          manager,
          organizationId,
          {
            locationId: receipt.inventoryLocationId,
            receiptId: receipt.id,
            notes: `Goods receipt note ${receiptNumber}`,
            lines: lines.map((line) => ({
              itemId: line.itemId,
              uomId: line.uomId,
              baseQuantity: Number(line.baseQuantity),
              unitCost: Number(line.unitCost),
            })),
          },
          actorId,
        );

      await this.planLimitService.consumePeriodic(
        organizationId,
        'purchase_receipts_per_month',
        manager,
      );

      receipt.status = 'POSTED';
      receipt.receiptNumber = receiptNumber;
      receipt.receiptDate = today.toISOString().slice(0, 10);
      receipt.receiptDateBs = todayBs;
      receipt.fiscalYearId = fiscalYear.id;
      receipt.inventoryTransactionId = inventoryTxn.id;
      await manager.getRepository(PurchaseReceiptEntity).save(receipt);

      await this.audit.record(
        {
          organizationId,
          branchId: receipt.branchId,
          userId: actorId,
          action: PURCHASE_AUDIT_ACTIONS.RECEIPT_POST,
          entityType: 'purchase_receipt',
          entityId: receipt.id,
          newData: {
            receiptNumber,
            status: 'POSTED',
            inventoryTransactionId: inventoryTxn.id,
            locationId: receipt.inventoryLocationId,
            lineCount: lines.length,
          },
        },
        manager,
      );

      return receipt.id;
    });

    return this.get(organizationId, postedId);
  }

  async voidReceipt(
    organizationId: string,
    actorId: string,
    id: string,
  ): Promise<PurchaseReceiptEntity> {
    return this.dataSource.transaction(async (manager) => {
      const receipt = await this.requireReceipt(manager, organizationId, id);
      if (receipt.status !== 'DRAFT') {
        throw new PurchaseReceiptNotDraftException(id, receipt.status, 'void');
      }

      receipt.status = 'CANCELLED';
      await manager.getRepository(PurchaseReceiptEntity).save(receipt);
      await this.audit.record(
        {
          organizationId,
          branchId: receipt.branchId,
          userId: actorId,
          action: PURCHASE_AUDIT_ACTIONS.RECEIPT_VOID,
          entityType: 'purchase_receipt',
          entityId: receipt.id,
          newData: { status: 'CANCELLED' },
        },
        manager,
      );

      return this.buildReceiptView(manager, organizationId, receipt.id);
    });
  }

  // ---- Reads --------------------------------------------------------------

  async get(
    organizationId: string,
    id: string,
  ): Promise<PurchaseReceiptEntity> {
    return this.buildReceiptView(this.dataSource.manager, organizationId, id);
  }

  async list(
    organizationId: string,
    query: PurchaseReceiptQueryDto,
  ): Promise<[PurchaseReceiptEntity[], number]> {
    const qb = this.receiptRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.party', 'party')
      .leftJoinAndSelect('r.inventoryLocation', 'inventoryLocation')
      .where('r.organization_id = :organizationId', { organizationId });

    if (query.status)
      qb.andWhere('r.status = :status', { status: query.status });
    if (query.partyId)
      qb.andWhere('r.party_id = :partyId', { partyId: query.partyId });
    if (query.inventoryLocationId) {
      qb.andWhere('r.inventory_location_id = :inventoryLocationId', {
        inventoryLocationId: query.inventoryLocationId,
      });
    }

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('r.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getMany();
    return [rows, total];
  }

  // ---- Shared -------------------------------------------------------------

  private async saveLines(
    manager: EntityManager,
    organizationId: string,
    receiptId: string,
    prepared: PreparedLine[],
  ): Promise<void> {
    const lineRepo = manager.getRepository(PurchaseReceiptLineEntity);
    await lineRepo.save(
      prepared.map((line) =>
        lineRepo.create({
          organizationId,
          receiptId,
          lineNo: line.lineNo,
          itemId: line.itemId,
          uomId: line.uomId,
          quantity: line.quantity.toFixed(3),
          baseQuantity: line.baseQuantity.toFixed(3),
          unitCost: line.unitCost.toFixed(2),
        }),
      ),
    );
  }

  private async prepareLines(
    manager: EntityManager,
    organizationId: string,
    lines: PurchaseReceiptLineDto[],
  ): Promise<PreparedLine[]> {
    const prepared: PreparedLine[] = [];
    for (const [index, line] of lines.entries()) {
      if (!line.quantity || line.quantity <= 0)
        throw new PurchaseReceiptZeroQuantityException();

      const item = await manager.getRepository(ItemEntity).findOne({
        where: { id: line.itemId, organizationId, isActive: true },
      });
      if (!item) throw new PurchaseReceiptItemNotFoundException(line.itemId);
      if (item.inventoryTracking !== 'QUANTITY') {
        throw new PurchaseReceiptItemNotTrackedException(
          line.itemId,
          item.inventoryTracking,
        );
      }

      const uom = await manager.getRepository(UomEntity).findOne({
        where: { id: line.uomId, organizationId },
      });
      if (!uom) throw new PurchaseReceiptUomNotFoundException(line.uomId);

      const baseQuantity = await this.toBaseQuantity(
        manager,
        organizationId,
        item,
        line.uomId,
        line.quantity,
      );
      const unitCost = line.unitCost ?? Number(item.standardCost ?? 0);

      prepared.push({
        lineNo: index + 1,
        itemId: item.id,
        uomId: uom.id,
        quantity: line.quantity,
        baseQuantity,
        unitCost,
      });
    }
    return prepared;
  }

  private async requireReceipt(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<PurchaseReceiptEntity> {
    const receipt = await manager.getRepository(PurchaseReceiptEntity).findOne({
      where: { id, organizationId },
      relations: { party: true },
    });
    if (!receipt) throw new PurchaseReceiptNotFoundException(id);
    return receipt;
  }

  private async buildReceiptView(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<PurchaseReceiptEntity> {
    const receipt = await manager.getRepository(PurchaseReceiptEntity).findOne({
      where: { id, organizationId },
      relations: {
        party: true,
        branch: true,
        fiscalYear: true,
        inventoryLocation: true,
        inventoryTransaction: true,
      },
    });
    if (!receipt) throw new PurchaseReceiptNotFoundException(id);
    receipt.lines = await manager
      .getRepository(PurchaseReceiptLineEntity)
      .find({
        where: { receiptId: receipt.id },
        relations: { item: true, uom: true },
        order: { lineNo: 'ASC' },
      });
    return receipt;
  }

  private async requireSupplier(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
  ): Promise<PartyEntity> {
    const supplier = await manager.getRepository(PartyEntity).findOne({
      where: { id: partyId, organizationId, isSupplier: true, isActive: true },
    });
    if (!supplier) throw new PurchaseReceiptSupplierNotFoundException(partyId);
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
    if (!location) throw new PurchaseReceiptLocationNotFoundException(id);
    return location;
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
      throw new PurchaseReceiptUomConversionNotFoundException(
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
      throw new PurchaseReceiptFiscalYearMissingException();
    }
    return fiscalYear;
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
