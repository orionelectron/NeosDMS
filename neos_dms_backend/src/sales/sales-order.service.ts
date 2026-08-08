import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { PartyEntity } from '../accounting/entities/party.entity';
import { AuditService } from '../audit/audit.service';
import { UserEntity } from '../iam/entities/user.entity';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { UomEntity } from '../trading/entities/uom.entity';
import {
  CreateSalesOrderDto,
  SalesOrderQueryDto,
  UpdateSalesOrderDto,
} from './dto/sales-order.dto';
import { SalesOrderLineEntity } from './entities/sales-order-line.entity';
import { SalesOrderEntity } from './entities/sales-order.entity';
import {
  SALES_ORDER_AUDIT_ACTIONS,
  SALES_ORDER_DOCUMENT_TYPE,
} from './sales.constants';
import {
  SalesOrderAccessDeniedException,
  SalesOrderCustomerNotFoundException,
  SalesOrderInvalidTransitionException,
  SalesOrderItemNotFoundException,
  SalesOrderNotFoundException,
  SalesOrderSalespersonNotFoundException,
  SalesOrderUomConversionNotFoundException,
  SalesOrderUomNotFoundException,
  SalesOrderZeroQuantityException,
} from './sales.errors';

const ROUND2 = (n: number): number => Math.round(n * 100) / 100;
const ROUND3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Minimal actor shape — roleCode is used for ownership/admin scoping. */
export interface OrderActor {
  id: string;
  roleCode: string | null;
}

export interface SalesOrderStockWarning {
  itemId: string;
  itemName: string;
  itemCode: string | null;
  onHand: number;
  ordered: number;
}

interface PreparedLine {
  lineNo: number;
  itemId: string;
  uomId: string;
  quantity: number;
  freeQuantity: number;
  baseQuantity: number;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
}

const TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ['CONFIRMED', 'CANCELED'],
  CONFIRMED: ['COMPLETED', 'CANCELED'],
  COMPLETED: [],
  CANCELED: [],
};

@Injectable()
export class SalesOrderService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(SalesOrderEntity)
    private readonly orderRepo: Repository<SalesOrderEntity>,
    @InjectRepository(SalesOrderLineEntity)
    private readonly lineRepo: Repository<SalesOrderLineEntity>,
    @InjectRepository(PartyEntity)
    private readonly partyRepo: Repository<PartyEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(InventoryBalanceEntity)
    private readonly balanceRepo: Repository<InventoryBalanceEntity>,
    private readonly audit: AuditService,
    private readonly documentSequenceService: DocumentSequenceService,
    private readonly nepaliDate: NepaliDateConverter,
  ) {}

  // ---- Mutations ----------------------------------------------------------

  async create(
    organizationId: string,
    actor: OrderActor,
    dto: CreateSalesOrderDto,
  ): Promise<SalesOrderEntity> {
    return this.dataSource.transaction(async (manager) => {
      const party = await this.requireCustomer(
        manager,
        organizationId,
        dto.partyId,
      );

      const salespersonId = dto.salespersonId ?? actor.id;
      if (salespersonId !== actor.id) {
        await this.assertCanAssign(
          organizationId,
          actor,
          salespersonId,
          manager,
        );
      }
      await this.requireSalesperson(manager, organizationId, salespersonId);

      const prepared = await this.prepareLines(
        manager,
        organizationId,
        dto.lines,
      );
      const discountAmount = dto.discountAmount ?? 0;
      const lineSum = prepared.reduce((sum, line) => sum + line.lineTotal, 0);
      const total = ROUND2(Math.max(0, lineSum - discountAmount));

      const today = this.nepaliDate.getTodayBsDate();
      const bsDate = `${today.bsYear}-${String(today.bsMonth).padStart(2, '0')}-${String(today.bsDay).padStart(2, '0')}`;

      const orderNumber = await this.documentSequenceService.nextNumber(
        {
          organizationId,
          branchId: dto.branchId ?? null,
          fiscalYearId: null,
          documentType: SALES_ORDER_DOCUMENT_TYPE,
        },
        manager,
      );

      const orderRepo = manager.getRepository(SalesOrderEntity);
      const lineRepo = manager.getRepository(SalesOrderLineEntity);
      const order = await orderRepo.save(
        orderRepo.create({
          organizationId,
          branchId: dto.branchId ?? null,
          orderNumber,
          partyId: party.id,
          salespersonId,
          status: 'DRAFT',
          bsDate,
          total: total.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          notes: dto.notes ?? null,
          customerRemarks: dto.customerRemarks ?? null,
        }),
      );

      await lineRepo.save(
        prepared.map((line) =>
          lineRepo.create({
            organizationId,
            orderId: order.id,
            lineNo: line.lineNo,
            itemId: line.itemId,
            uomId: line.uomId,
            quantity: line.quantity.toFixed(3),
            freeQuantity: line.freeQuantity.toFixed(3),
            baseQuantity: line.baseQuantity.toFixed(3),
            unitPrice: line.unitPrice.toFixed(2),
            discountPercent: line.discountPercent.toFixed(2),
            lineTotal: line.lineTotal.toFixed(2),
          }),
        ),
      );

      await this.audit.record(
        {
          organizationId,
          userId: actor.id,
          action: SALES_ORDER_AUDIT_ACTIONS.CREATE,
          entityType: 'sales_order',
          entityId: order.id,
          newData: {
            orderNumber,
            partyId: party.id,
            salespersonId,
            status: 'DRAFT',
            total: total.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
            customerRemarks: dto.customerRemarks ?? null,
            lineCount: prepared.length,
          },
        },
        manager,
      );

      return this.buildOrderView(manager, organizationId, order.id);
    });
  }

  async update(
    organizationId: string,
    actor: OrderActor,
    id: string,
    dto: UpdateSalesOrderDto,
  ): Promise<SalesOrderEntity> {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(SalesOrderEntity);
      const order = await this.requireOrder(manager, organizationId, id);
      await this.assertCanAccessOrder(organizationId, actor, order);
      if (order.status !== 'DRAFT') {
        throw new SalesOrderInvalidTransitionException(order.status, 'update');
      }

      if (dto.partyId !== undefined && dto.partyId !== order.partyId) {
        const party = await this.requireCustomer(
          manager,
          organizationId,
          dto.partyId,
        );
        order.partyId = party.id;
      }
      if (dto.salespersonId !== undefined) {
        await this.assertCanAssign(
          organizationId,
          actor,
          dto.salespersonId,
          manager,
        );
        await this.requireSalesperson(
          manager,
          organizationId,
          dto.salespersonId,
        );
        order.salespersonId = dto.salespersonId;
      }
      if (dto.branchId !== undefined) order.branchId = dto.branchId;
      if (dto.notes !== undefined) order.notes = dto.notes;
      if (dto.customerRemarks !== undefined)
        order.customerRemarks = dto.customerRemarks;
      if (dto.discountAmount !== undefined)
        order.discountAmount = dto.discountAmount.toFixed(2);

      if (dto.lines !== undefined) {
        const prepared = await this.prepareLines(
          manager,
          organizationId,
          dto.lines,
        );
        const lineRepo = manager.getRepository(SalesOrderLineEntity);
        await lineRepo.delete({ orderId: order.id });
        await lineRepo.save(
          prepared.map((line) =>
            lineRepo.create({
              organizationId,
              orderId: order.id,
              lineNo: line.lineNo,
              itemId: line.itemId,
              uomId: line.uomId,
              quantity: line.quantity.toFixed(3),
              freeQuantity: line.freeQuantity.toFixed(3),
              baseQuantity: line.baseQuantity.toFixed(3),
              unitPrice: line.unitPrice.toFixed(2),
              discountPercent: line.discountPercent.toFixed(2),
              lineTotal: line.lineTotal.toFixed(2),
            }),
          ),
        );
        const lineSum = prepared.reduce((sum, line) => sum + line.lineTotal, 0);
        order.total = ROUND2(
          Math.max(0, lineSum - Number(order.discountAmount)),
        ).toFixed(2);
      }

      await orderRepo.save(order);
      await this.audit.record(
        {
          organizationId,
          userId: actor.id,
          action: SALES_ORDER_AUDIT_ACTIONS.UPDATE,
          entityType: 'sales_order',
          entityId: order.id,
          newData: {
            status: order.status,
            total: order.total,
            discountAmount: order.discountAmount,
            partyId: order.partyId,
            salespersonId: order.salespersonId,
          },
        },
        manager,
      );

      return this.buildOrderView(manager, organizationId, order.id);
    });
  }

  async confirm(
    organizationId: string,
    actor: OrderActor,
    id: string,
  ): Promise<{
    order: SalesOrderEntity;
    stockWarnings: SalesOrderStockWarning[];
  }> {
    const order = await this.requireOrder(
      this.dataSource.manager,
      organizationId,
      id,
    );
    await this.assertCanAccessOrder(organizationId, actor, order);
    this.assertTransition(order.status, 'CONFIRMED', 'confirm');

    order.status = 'CONFIRMED';
    await this.orderRepo.save(order);
    await this.audit.record({
      organizationId,
      userId: actor.id,
      action: SALES_ORDER_AUDIT_ACTIONS.CONFIRM,
      entityType: 'sales_order',
      entityId: order.id,
      newData: { status: 'CONFIRMED' },
    });

    const saved = await this.buildOrderView(
      this.dataSource.manager,
      organizationId,
      order.id,
    );
    return {
      order: saved,
      stockWarnings: await this.stockWarnings(organizationId, saved),
    };
  }

  async complete(
    organizationId: string,
    actor: OrderActor,
    id: string,
  ): Promise<SalesOrderEntity> {
    const order = await this.requireOrder(
      this.dataSource.manager,
      organizationId,
      id,
    );
    await this.assertCanAccessOrder(organizationId, actor, order);
    this.assertTransition(order.status, 'COMPLETED', 'complete');

    order.status = 'COMPLETED';
    await this.orderRepo.save(order);
    await this.audit.record({
      organizationId,
      userId: actor.id,
      action: SALES_ORDER_AUDIT_ACTIONS.COMPLETE,
      entityType: 'sales_order',
      entityId: order.id,
      newData: { status: 'COMPLETED' },
    });

    return this.buildOrderView(
      this.dataSource.manager,
      organizationId,
      order.id,
    );
  }

  async cancel(
    organizationId: string,
    actor: OrderActor,
    id: string,
  ): Promise<SalesOrderEntity> {
    const order = await this.requireOrder(
      this.dataSource.manager,
      organizationId,
      id,
    );
    await this.assertCanAccessOrder(organizationId, actor, order);
    this.assertTransition(order.status, 'CANCELED', 'cancel');

    order.status = 'CANCELED';
    await this.orderRepo.save(order);
    await this.audit.record({
      organizationId,
      userId: actor.id,
      action: SALES_ORDER_AUDIT_ACTIONS.CANCEL,
      entityType: 'sales_order',
      entityId: order.id,
      newData: { status: 'CANCELED' },
    });

    return this.buildOrderView(
      this.dataSource.manager,
      organizationId,
      order.id,
    );
  }

  // ---- Reads --------------------------------------------------------------

  async get(
    organizationId: string,
    actor: OrderActor,
    id: string,
  ): Promise<SalesOrderEntity> {
    const order = await this.requireOrder(
      this.dataSource.manager,
      organizationId,
      id,
    );
    await this.assertCanAccessOrder(organizationId, actor, order);
    return this.buildOrderView(this.dataSource.manager, organizationId, id);
  }

  async list(
    organizationId: string,
    actor: OrderActor,
    scope: 'mine' | 'team' | 'all',
    query: SalesOrderQueryDto,
  ): Promise<[SalesOrderEntity[], number]> {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.party', 'party')
      .leftJoinAndSelect('o.salesperson', 'salesperson')
      .where('o.organization_id = :organizationId', { organizationId });

    if (scope === 'mine') {
      qb.andWhere('o.salesperson_id = :actorId', { actorId: actor.id });
    } else if (scope === 'team') {
      const teamIds = await this.userRepo
        .find({ where: { organizationId, managerId: actor.id } })
        .then((rows) => rows.map((r) => r.id));
      if (teamIds.length === 0) return [[], 0];
      qb.andWhere('o.salesperson_id IN (:...teamIds)', { teamIds });
    }

    if (query.status)
      qb.andWhere('o.status = :status', { status: query.status });
    if (query.partyId)
      qb.andWhere('o.party_id = :partyId', { partyId: query.partyId });
    if (query.salespersonId) {
      qb.andWhere('o.salesperson_id = :salespersonId', {
        salespersonId: query.salespersonId,
      });
    }

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('o.bs_date', 'DESC')
      .addOrderBy('o.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getMany();
    return [rows, total];
  }

  // ---- Shared -------------------------------------------------------------

  private async prepareLines(
    manager: EntityManager,
    organizationId: string,
    lines: CreateSalesOrderDto['lines'],
  ): Promise<PreparedLine[]> {
    const prepared: PreparedLine[] = [];
    for (const [index, line] of lines.entries()) {
      const item = await manager.getRepository(ItemEntity).findOne({
        where: { id: line.itemId, organizationId, isActive: true },
      });
      if (!item) throw new SalesOrderItemNotFoundException(line.itemId);

      const uom = await manager.getRepository(UomEntity).findOne({
        where: { id: line.uomId, organizationId },
      });
      if (!uom) throw new SalesOrderUomNotFoundException(line.uomId);

      const quantity = line.quantity;
      const freeQuantity = line.freeQuantity ?? 0;
      if (quantity <= 0 && freeQuantity <= 0)
        throw new SalesOrderZeroQuantityException();

      // base quantity covers everything that ships (billed + free units)
      const baseQuantity = await this.toBaseQuantity(
        manager,
        organizationId,
        item,
        line.uomId,
        quantity + freeQuantity,
      );
      const unitPrice = line.unitPrice ?? Number(item.rlp ?? 0);
      const discountPercent = line.discountPercent ?? 0;
      // free units are never billed; percent discount applies to billed qty
      const lineTotal = Math.max(
        0,
        ROUND2(line.quantity * unitPrice * (1 - discountPercent / 100)),
      );

      prepared.push({
        lineNo: index + 1,
        itemId: item.id,
        uomId: uom.id,
        quantity,
        freeQuantity,
        baseQuantity,
        unitPrice,
        discountPercent,
        lineTotal,
      });
    }
    return prepared;
  }

  /** Warn-only availability (org-wide on-hand vs ordered base quantity). */
  private async stockWarnings(
    organizationId: string,
    order: SalesOrderEntity,
  ): Promise<SalesOrderStockWarning[]> {
    const itemIds = order.lines.map((line) => line.itemId);
    const raw = await this.balanceRepo
      .createQueryBuilder('b')
      .select('b.item_id AS "itemId"')
      .addSelect('COALESCE(SUM(b.quantity), 0) AS "onHand"')
      .where('b.organization_id = :organizationId', { organizationId })
      .andWhere('b.item_id IN (:...itemIds)', { itemIds })
      .groupBy('b.item_id')
      .getRawMany<{ itemId: string; onHand: string }>();

    const onHand = new Map<string, number>(
      raw.map((row) => [row.itemId, Number(row.onHand)]),
    );

    return order.lines
      .filter(
        (line) => Number(line.baseQuantity) > (onHand.get(line.itemId) ?? 0),
      )
      .map((line) => ({
        itemId: line.itemId,
        itemName: line.item?.name ?? 'Unknown',
        itemCode: line.item?.code ?? null,
        onHand: onHand.get(line.itemId) ?? 0,
        ordered: Number(line.baseQuantity),
      }));
  }

  /** Converts a quantity in `uomId` to the item's base uom (same rule as inventory). */
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
      throw new SalesOrderUomConversionNotFoundException(
        uomId,
        item.baseUomId,
        item.id,
      );

    return ROUND3(Number(quantity) * Number(conversion.conversionFactor));
  }

  private async requireOrder(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<SalesOrderEntity> {
    const order = await manager.getRepository(SalesOrderEntity).findOne({
      where: { id, organizationId },
      relations: {
        party: true,
        salesperson: true,
      },
    });
    if (!order) throw new SalesOrderNotFoundException(id);
    return order;
  }

  /**
   * Loads the aggregate from fresh queries on the given manager. The header and
   * lines are queried separately so mutations inside the same transaction are
   * always reflected (no identity-map relation reuse).
   */
  private async buildOrderView(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<SalesOrderEntity> {
    const order = await manager.getRepository(SalesOrderEntity).findOne({
      where: { id, organizationId },
      relations: { party: true, salesperson: true },
    });
    if (!order) throw new SalesOrderNotFoundException(id);
    order.lines = await manager.getRepository(SalesOrderLineEntity).find({
      where: { orderId: order.id },
      relations: { item: true, uom: true },
      order: { lineNo: 'ASC' },
    });
    return order;
  }

  private async requireCustomer(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
  ): Promise<PartyEntity> {
    const party = await manager.getRepository(PartyEntity).findOne({
      where: { id: partyId, organizationId, isCustomer: true, isActive: true },
    });
    if (!party) throw new SalesOrderCustomerNotFoundException(partyId);
    return party;
  }

  private async requireSalesperson(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<UserEntity> {
    const user = await manager.getRepository(UserEntity).findOne({
      where: { id, organizationId, isActive: true },
    });
    if (!user) throw new SalesOrderSalespersonNotFoundException(id);
    return user;
  }

  /** Own order, or admin, or manager of the salesperson. */
  private async assertCanAccessOrder(
    organizationId: string,
    actor: OrderActor,
    order: SalesOrderEntity,
  ): Promise<void> {
    if (order.salespersonId === actor.id) return;
    if (actor.roleCode === 'admin') return;
    const salesperson = await this.userRepo.findOne({
      where: { id: order.salespersonId, organizationId },
    });
    if (salesperson && salesperson.managerId === actor.id) return;
    throw new SalesOrderAccessDeniedException();
  }

  /** Only admins and the salesperson's manager may assign another person. */
  private async assertCanAssign(
    organizationId: string,
    actor: OrderActor,
    salespersonId: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (actor.roleCode === 'admin') return;
    const repo = manager ? manager.getRepository(UserEntity) : this.userRepo;
    const salesperson = await repo.findOne({
      where: { id: salespersonId, organizationId },
    });
    if (salesperson && salesperson.managerId === actor.id) return;
    throw new SalesOrderAccessDeniedException();
  }

  private assertTransition(from: string, to: string, action: string): void {
    if (!TRANSITIONS[from]?.includes(to)) {
      throw new SalesOrderInvalidTransitionException(from, action);
    }
  }
}
