import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { AuditService } from '../audit/audit.service';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { ItemNotFoundException } from '../trading/trading.errors';
import {
  InventoryBalanceQueryDto,
  InventoryTransactionQueryDto,
  OpeningStockDto,
  StockAdjustmentDto,
  StockTransferDto,
} from './dto/inventory.dto';
import { InventoryBalanceEntity } from './entities/inventory-balance.entity';
import { InventoryLocationEntity } from './entities/inventory-location.entity';
import { InventoryTransactionLineEntity } from './entities/inventory-transaction-line.entity';
import { InventoryTransactionEntity } from './entities/inventory-transaction.entity';
import { INVENTORY_AUDIT_ACTIONS } from './inventory.constants';
import {
  InventoryInsufficientStockException,
  InventoryItemNotTrackedException,
  InventoryLocationNotFoundException,
  InventoryNegativeQuantityException,
  InventoryOpeningStockAlreadyDoneException,
  InventorySameLocationTransferException,
  InventoryTransactionNotFoundException,
  InventoryUomConversionNotFoundException,
  InventoryZeroQuantityException,
} from './inventory.errors';

const ROUND3 = (n: number): number => Math.round(n * 1000) / 1000;

export interface InventoryLowStockRow {
  itemId: string;
  itemName: string;
  itemCode: string | null;
  locationId: string | null;
  locationName: string | null;
  onHand: number;
  reorderLevel: number;
}

interface InventoryLowStockRaw {
  itemId: string;
  itemName: string;
  itemCode: string | null;
  locationId: string | null;
  locationName: string | null;
  onHand: string;
  reorderLevel: string;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(InventoryTransactionEntity)
    private readonly txnRepo: Repository<InventoryTransactionEntity>,
    @InjectRepository(InventoryBalanceEntity)
    private readonly balanceRepo: Repository<InventoryBalanceEntity>,
    private readonly auditService: AuditService,
    private readonly documentSequenceService: DocumentSequenceService,
    private readonly nepaliDate: NepaliDateConverter,
  ) {}

  async postOpening(
    organizationId: string,
    dto: OpeningStockDto,
    actorId: string,
  ): Promise<InventoryTransactionEntity> {
    return this.dataSource.transaction(async (manager) => {
      await this.requireLocation(manager, organizationId, dto.locationId);

      const prepared = await Promise.all(
        dto.lines.map(async (line) => {
          if (line.direction === 'OUT')
            throw new InventoryNegativeQuantityException();
          if (!line.quantity) throw new InventoryZeroQuantityException();
          const item = await this.requireTrackedItem(
            manager,
            organizationId,
            line.itemId,
          );
          const baseQty = await this.toBaseQuantity(
            manager,
            organizationId,
            item,
            line.uomId,
            line.quantity,
          );
          return { line, item, baseQty };
        }),
      );

      for (const { item } of prepared) {
        const balance = await this.lockBalance(
          manager,
          organizationId,
          dto.locationId,
          item.id,
        );
        if (balance)
          throw new InventoryOpeningStockAlreadyDoneException(
            dto.locationId,
            item.id,
          );
      }

      const txn = await this.saveTransaction(
        manager,
        organizationId,
        {
          locationId: dto.locationId,
          toLocationId: null,
          type: 'opening_stock',
          notes: dto.notes ?? null,
        },
        prepared.map(({ line, item, baseQty }) => ({
          itemId: item.id,
          uomId: line.uomId,
          direction: 'IN',
          quantity: baseQty,
          unitCost: line.unitCost ?? 0,
        })),
        actorId,
      );

      for (const { item, baseQty } of prepared) {
        await this.applyDelta(
          manager,
          organizationId,
          dto.locationId,
          item.id,
          baseQty,
          item.allowNegativeStock,
        );
      }

      return txn;
    });
  }

  async postAdjustment(
    organizationId: string,
    dto: StockAdjustmentDto,
    actorId: string,
  ): Promise<InventoryTransactionEntity> {
    return this.dataSource.transaction(async (manager) => {
      await this.requireLocation(manager, organizationId, dto.locationId);

      const prepared = await Promise.all(
        dto.lines.map(async (line) => {
          if (!line.quantity) throw new InventoryZeroQuantityException();
          const item = await this.requireTrackedItem(
            manager,
            organizationId,
            line.itemId,
          );
          const baseQty = await this.toBaseQuantity(
            manager,
            organizationId,
            item,
            line.uomId,
            line.quantity,
          );
          const direction = line.direction ?? 'IN';
          return {
            line,
            item,
            baseQty,
            direction,
            delta: direction === 'IN' ? baseQty : -baseQty,
          };
        }),
      );

      const txn = await this.saveTransaction(
        manager,
        organizationId,
        {
          locationId: dto.locationId,
          toLocationId: null,
          type: 'stock_adjustment',
          notes: dto.notes ?? null,
        },
        prepared.map(({ line, item, baseQty, direction }) => ({
          itemId: item.id,
          uomId: line.uomId,
          direction,
          quantity: baseQty,
          unitCost: line.unitCost ?? 0,
        })),
        actorId,
      );

      for (const { item, delta } of prepared) {
        await this.applyDelta(
          manager,
          organizationId,
          dto.locationId,
          item.id,
          delta,
          item.allowNegativeStock,
        );
      }

      return txn;
    });
  }

  async postTransfer(
    organizationId: string,
    dto: StockTransferDto,
    actorId: string,
  ): Promise<InventoryTransactionEntity> {
    if (dto.fromLocationId === dto.toLocationId)
      throw new InventorySameLocationTransferException();

    return this.dataSource.transaction(async (manager) => {
      await this.requireLocation(manager, organizationId, dto.fromLocationId);
      await this.requireLocation(manager, organizationId, dto.toLocationId);

      const prepared = await Promise.all(
        dto.lines.map(async (line) => {
          if (line.direction === 'OUT')
            throw new InventoryNegativeQuantityException();
          if (!line.quantity) throw new InventoryZeroQuantityException();
          const item = await this.requireTrackedItem(
            manager,
            organizationId,
            line.itemId,
          );
          const baseQty = await this.toBaseQuantity(
            manager,
            organizationId,
            item,
            line.uomId,
            line.quantity,
          );
          return { line, item, baseQty };
        }),
      );

      const txn = await this.saveTransaction(
        manager,
        organizationId,
        {
          locationId: dto.fromLocationId,
          toLocationId: dto.toLocationId,
          type: 'stock_transfer',
          notes: dto.notes ?? null,
        },
        prepared.map(({ line, item, baseQty }) => ({
          itemId: item.id,
          uomId: line.uomId,
          direction: 'IN',
          quantity: baseQty,
          unitCost: line.unitCost ?? 0,
        })),
        actorId,
      );

      for (const { item, baseQty } of prepared) {
        await this.applyDelta(
          manager,
          organizationId,
          dto.fromLocationId,
          item.id,
          -baseQty,
          item.allowNegativeStock,
        );
        await this.applyDelta(
          manager,
          organizationId,
          dto.toLocationId,
          item.id,
          baseQty,
          item.allowNegativeStock,
        );
      }

      return txn;
    });
  }

  /**
   * Manager-scoped stock issue for a posted sales invoice. Runs inside the
   * invoice's own transaction so the document number, journal, and stock all
   * commit atomically. Draws (quantity + free) base units from the location.
   */
  async issueForSalesInvoice(
    manager: EntityManager,
    organizationId: string,
    input: {
      locationId: string;
      invoiceId: string;
      notes: string | null;
      lines: Array<{
        itemId: string;
        uomId: string;
        baseQuantity: number;
        unitCost: number;
      }>;
    },
    actorId: string,
  ): Promise<InventoryTransactionEntity> {
    await this.requireLocation(manager, organizationId, input.locationId);

    const prepared = await Promise.all(
      input.lines.map(async (line) => {
        if (line.baseQuantity <= 0) throw new InventoryZeroQuantityException();
        const item = await this.requireTrackedItem(
          manager,
          organizationId,
          line.itemId,
        );
        return { line, item };
      }),
    );

    const txn = await this.saveTransaction(
      manager,
      organizationId,
      {
        locationId: input.locationId,
        toLocationId: null,
        type: 'sales_invoice',
        notes: input.notes,
        referenceType: 'sales_invoice',
        referenceId: input.invoiceId,
      },
      prepared.map(({ line, item }) => ({
        itemId: item.id,
        uomId: line.uomId,
        direction: 'OUT',
        quantity: line.baseQuantity,
        unitCost: line.unitCost,
      })),
      actorId,
    );

    for (const { line, item } of prepared) {
      await this.applyDelta(
        manager,
        organizationId,
        input.locationId,
        item.id,
        -line.baseQuantity,
        item.allowNegativeStock,
      );
    }

    return txn;
  }

  /**
   * Manager-scoped stock receipt for a posted goods receipt note (GRN). Runs
   * inside the receipt's own transaction so the document number and stock
   * commit atomically. Adds `baseQuantity` base units to the location.
   * Quantity-only — inventory value/avg_cost is never touched here (decision
   * 42); `unitCost` seeds the later purchase bill.
   */
  async receiveForPurchaseReceipt(
    manager: EntityManager,
    organizationId: string,
    input: {
      locationId: string;
      receiptId: string;
      notes: string | null;
      lines: Array<{
        itemId: string;
        uomId: string;
        baseQuantity: number;
        unitCost: number;
      }>;
    },
    actorId: string,
  ): Promise<InventoryTransactionEntity> {
    await this.requireLocation(manager, organizationId, input.locationId);

    const prepared = await Promise.all(
      input.lines.map(async (line) => {
        if (line.baseQuantity <= 0) throw new InventoryZeroQuantityException();
        const item = await this.requireTrackedItem(
          manager,
          organizationId,
          line.itemId,
        );
        return { line, item };
      }),
    );

    const txn = await this.saveTransaction(
      manager,
      organizationId,
      {
        locationId: input.locationId,
        toLocationId: null,
        type: 'purchase_receipt',
        notes: input.notes,
        referenceType: 'purchase_receipt',
        referenceId: input.receiptId,
      },
      prepared.map(({ line, item }) => ({
        itemId: item.id,
        uomId: line.uomId,
        direction: 'IN',
        quantity: line.baseQuantity,
        unitCost: line.unitCost,
      })),
      actorId,
    );

    for (const { line, item } of prepared) {
      await this.applyDelta(
        manager,
        organizationId,
        input.locationId,
        item.id,
        line.baseQuantity,
        item.allowNegativeStock,
      );
    }

    return txn;
  }

  async listTransactions(
    organizationId: string,
    query: InventoryTransactionQueryDto,
  ): Promise<[InventoryTransactionEntity[], number]> {
    const qb = this.txnRepo
      .createQueryBuilder('txn')
      .leftJoinAndSelect('txn.location', 'location')
      .leftJoinAndSelect('txn.toLocation', 'toLocation')
      .where('txn.organizationId = :organizationId', { organizationId });

    if (query.locationId) {
      qb.andWhere('txn.locationId = :locationId', {
        locationId: query.locationId,
      });
    }
    if (query.type) {
      qb.andWhere('txn.transactionType = :type', { type: query.type });
    }
    if (query.itemId) {
      qb.innerJoin(
        InventoryTransactionLineEntity,
        'line',
        'line.transactionId = txn.id',
      ).andWhere('line.itemId = :itemId', { itemId: query.itemId });
    }

    const [rows, total] = await qb
      .orderBy('txn.occurredAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }

  async getTransaction(
    organizationId: string,
    id: string,
  ): Promise<InventoryTransactionEntity> {
    const txn = await this.txnRepo.findOne({
      where: { id, organizationId },
      relations: {
        location: true,
        toLocation: true,
        lines: { item: true, uom: true },
      },
    });
    if (!txn) throw new InventoryTransactionNotFoundException(id);
    return txn;
  }

  async listBalances(
    organizationId: string,
    query: InventoryBalanceQueryDto,
  ): Promise<[InventoryBalanceEntity[], number]> {
    const qb = this.balanceRepo
      .createQueryBuilder('balance')
      .leftJoinAndSelect('balance.location', 'location')
      .leftJoinAndSelect('balance.item', 'item')
      .where('balance.organizationId = :organizationId', { organizationId });

    if (query.locationId) {
      qb.andWhere('balance.locationId = :locationId', {
        locationId: query.locationId,
      });
    }
    if (query.itemId) {
      qb.andWhere('balance.itemId = :itemId', { itemId: query.itemId });
    }
    if (!query.includeZero) {
      qb.andWhere('balance.quantity <> 0');
    }

    const [rows, total] = await qb
      .orderBy('location.name', 'ASC')
      .addOrderBy('item.name', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }

  /**
   * Low-stock report: active quantity-tracked items whose on-hand (zero if
   * never stocked) is at or below `reorder_level`. Stocked items appear per
   * location; unstocked items appear once with no location.
   */
  async lowStock(
    organizationId: string,
    query: { page: number; limit: number },
  ): Promise<[InventoryLowStockRow[], number]> {
    const qb = this.balanceRepo.manager
      .getRepository(ItemEntity)
      .createQueryBuilder('item')
      .leftJoin(
        InventoryBalanceEntity,
        'balance',
        'balance.item_id = item.id AND balance.organization_id = :organizationId AND balance."deletedAt" IS NULL',
      )
      .leftJoin(
        InventoryLocationEntity,
        'location',
        'location.id = balance.location_id',
      )
      .select([
        'item.id AS "itemId"',
        'item.name AS "itemName"',
        'item.code AS "itemCode"',
        'location.id AS "locationId"',
        'location.name AS "locationName"',
        'COALESCE(balance.quantity, 0) AS "onHand"',
        'item.reorder_level AS "reorderLevel"',
      ])
      .where('item.organizationId = :organizationId', { organizationId })
      .andWhere("item.inventory_tracking = 'QUANTITY'")
      .andWhere('item.is_active = true')
      .andWhere('item.reorder_level > 0')
      .andWhere(
        '(balance.id IS NULL OR balance.quantity <= item.reorder_level)',
      )
      .setParameter('organizationId', organizationId);

    const rows = await qb
      .orderBy('"reorderLevel"', 'ASC')
      .getRawMany<InventoryLowStockRaw>();
    const total = rows.length;
    const pageRows = rows.slice(
      (query.page - 1) * query.limit,
      query.page * query.limit,
    );
    const data: InventoryLowStockRow[] = pageRows.map((row) => ({
      itemId: row.itemId,
      itemName: row.itemName,
      itemCode: row.itemCode,
      locationId: row.locationId,
      locationName: row.locationName,
      onHand: Number(row.onHand),
      reorderLevel: Number(row.reorderLevel),
    }));
    return [data, total];
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
    if (!location) throw new InventoryLocationNotFoundException(id);
    return location;
  }

  private async requireTrackedItem(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<ItemEntity> {
    const item = await manager.getRepository(ItemEntity).findOne({
      where: { id, organizationId },
    });
    if (!item) throw new ItemNotFoundException(id);
    if (item.inventoryTracking !== 'QUANTITY') {
      throw new InventoryItemNotTrackedException(id, item.inventoryTracking);
    }
    return item;
  }

  /** Converts a quantity in `uomId` to the item's base uom. */
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
      throw new InventoryUomConversionNotFoundException(
        uomId,
        item.baseUomId,
        item.id,
      );

    return ROUND3(Number(quantity) * Number(conversion.conversionFactor));
  }

  private async lockBalance(
    manager: EntityManager,
    organizationId: string,
    locationId: string,
    itemId: string,
  ): Promise<InventoryBalanceEntity | null> {
    return manager
      .getRepository(InventoryBalanceEntity)
      .createQueryBuilder('balance')
      .where('balance.organizationId = :organizationId', { organizationId })
      .andWhere('balance.locationId = :locationId', { locationId })
      .andWhere('balance.itemId = :itemId', { itemId })
      .setLock('pessimistic_write')
      .getOne();
  }

  private async applyDelta(
    manager: EntityManager,
    organizationId: string,
    locationId: string,
    itemId: string,
    delta: number,
    allowNegative: boolean,
  ): Promise<void> {
    const repo = manager.getRepository(InventoryBalanceEntity);
    const balance = await this.lockBalance(
      manager,
      organizationId,
      locationId,
      itemId,
    );

    if (!balance) {
      if (delta < 0 && !allowNegative)
        throw new InventoryInsufficientStockException(
          itemId,
          '0',
          String(-delta),
        );
      await repo.save(
        repo.create({
          organizationId,
          locationId,
          itemId,
          quantity: delta.toFixed(3),
        }),
      );
      return;
    }

    const current = Number(balance.quantity);
    const next = ROUND3(current + delta);
    if (next < 0 && !allowNegative) {
      throw new InventoryInsufficientStockException(
        itemId,
        current.toFixed(3),
        String(Math.abs(delta)),
      );
    }
    await repo.update({ id: balance.id }, { quantity: next.toFixed(3) });
  }

  private async saveTransaction(
    manager: EntityManager,
    organizationId: string,
    input: {
      locationId: string;
      toLocationId: string | null;
      type:
        | 'opening_stock'
        | 'stock_adjustment'
        | 'stock_transfer'
        | 'sales_invoice'
        | 'purchase_receipt';
      notes: string | null;
      referenceType?: string | null;
      referenceId?: string | null;
    },
    lines: Array<{
      itemId: string;
      uomId: string;
      direction: 'IN' | 'OUT';
      quantity: number;
      unitCost: number;
    }>,
    actorId: string,
  ): Promise<InventoryTransactionEntity> {
    const txnRepo = manager.getRepository(InventoryTransactionEntity);
    const lineRepo = manager.getRepository(InventoryTransactionLineEntity);

    const today = this.nepaliDate.getTodayBsDate();
    const bsDate = `${today.bsYear}-${String(today.bsMonth).padStart(2, '0')}-${String(today.bsDay).padStart(2, '0')}`;

    const transactionNumber = await this.documentSequenceService.nextNumber(
      {
        organizationId,
        branchId: null,
        fiscalYearId: null,
        documentType: input.type,
      },
      manager,
    );

    const txn = await txnRepo.save(
      txnRepo.create({
        organizationId,
        locationId: input.locationId,
        toLocationId: input.toLocationId,
        transactionNumber,
        transactionType: input.type,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        status: 'POSTED',
        bsDate,
        occurredAt: new Date(),
        notes: input.notes,
      }),
    );

    await lineRepo.save(
      lines.map((line) =>
        lineRepo.create({
          organizationId,
          transactionId: txn.id,
          itemId: line.itemId,
          uomId: line.uomId,
          direction: line.direction,
          quantity: line.quantity.toFixed(3),
          unitCost: line.unitCost.toFixed(2),
        }),
      ),
    );

    await this.auditService.record(
      {
        organizationId,
        userId: actorId,
        action: INVENTORY_AUDIT_ACTIONS.TXN_POST,
        entityType: 'inventory_transaction',
        entityId: txn.id,
        newData: {
          transactionNumber,
          transactionType: input.type,
          locationId: input.locationId,
          toLocationId: input.toLocationId,
          lineCount: lines.length,
        },
      },
      manager,
    );

    const saved = await txnRepo.findOne({
      where: { id: txn.id },
      relations: {
        location: true,
        toLocation: true,
        lines: { item: true, uom: true },
      },
    });
    return saved!;
  }
}
