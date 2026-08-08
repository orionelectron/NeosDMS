import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { FiscalYearEntity } from '../accounting/entities/fiscal-year.entity';
import { AuditService } from '../audit/audit.service';
import { RouteEntity } from '../field/entities/route.entity';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { InventoryLocationEntity } from '../inventory/entities/inventory-location.entity';
import { UserEntity } from '../iam/entities/user.entity';
import { SalesInvoiceService } from '../sales/sales-invoice.service';
import { SalesReturnService } from '../sales/sales-return.service';
import { OrderActor } from '../sales/sales-order.service';
import { SalesOrderEntity } from '../sales/entities/sales-order.entity';
import { SalesOrderLineEntity } from '../sales/entities/sales-order-line.entity';
import { SalesInvoiceLineEntity } from '../sales/entities/sales-invoice-line.entity';
import { BranchEntity } from '../tenancy/entities/branch.entity';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import {
  CreateDispatchDto,
  DeliverStopDto,
  DispatchQueryDto,
  FailStopDto,
  UpdateDispatchDto,
} from './dto/dispatch.dto';
import {
  DISPATCH_AUDIT_ACTIONS,
  DISPATCH_DOCUMENT_TYPE,
  DISPATCH_NUMBER_PREFIX,
  DRIVER_ROLE_CODE,
} from './dispatch.constants';
import {
  DispatchAccessDeniedException,
  DispatchAlreadyResolvedException,
  DispatchBranchNotFoundException,
  DispatchCompleteStopsPendingException,
  DispatchDepartureNoLocationException,
  DispatchDepartureNotLoadedException,
  DispatchDeliveryEventMismatchException,
  DispatchDriverActionNotAllowedException,
  DispatchDriverBusyException,
  DispatchDriverNotFoundException,
  DispatchInvalidTransitionException,
  DispatchLocationNotFoundException,
  DispatchNoStopsException,
  DispatchNotFoundException,
  DispatchOrderAlreadyAllocatedException,
  DispatchOrderNotAllocatableException,
  DispatchOrderNotFoundException,
  DispatchOrderNothingToDispatchException,
  DispatchRouteNotFoundException,
  DispatchShortfallInvoiceMissingException,
  DispatchStockInsufficientException,
  DispatchStopLineMismatchException,
  DispatchStopLineNotFoundException,
  DispatchStopNothingRecordedException,
  DispatchStopQuantitiesExceededException,
  DispatchVehicleBusyException,
  DispatchVehicleDriverRequiredException,
  DispatchVehicleNotFoundException,
} from './dispatch.errors';
import { DispatchEntity } from './entities/dispatch.entity';
import { DispatchStopEntity } from './entities/dispatch-stop.entity';
import { DispatchStopLineEntity } from './entities/dispatch-stop-line.entity';
import { VehicleEntity } from './entities/vehicle.entity';

const ROUND3 = (n: number): number => Math.round(n * 1000) / 1000;

const ACTIVE_DISPATCH_STATUSES = ['ALLOCATED', 'LOADED', 'IN_TRANSIT'] as const;

@Injectable()
export class DispatchService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(DispatchEntity)
    private readonly dispatchRepo: Repository<DispatchEntity>,
    private readonly audit: AuditService,
    private readonly documentSequenceService: DocumentSequenceService,
    private readonly salesInvoiceService: SalesInvoiceService,
    private readonly salesReturnService: SalesReturnService,
  ) {}

  // ── Create / update ------------------------------------------------------

  async create(
    organizationId: string,
    actor: OrderActor,
    dto: CreateDispatchDto,
  ): Promise<DispatchEntity> {
    this.assertNotDriver(actor, 'create');

    return this.dataSource.transaction(async (manager) => {
      const vehicle = dto.vehicleId
        ? await this.requireVehicle(manager, organizationId, dto.vehicleId)
        : null;
      const driver = dto.driverId
        ? await this.requireDriver(manager, organizationId, dto.driverId)
        : null;
      if (dto.routeId) {
        await this.requireRoute(manager, organizationId, dto.routeId);
      }
      if (dto.branchId) {
        await this.requireBranch(manager, organizationId, dto.branchId);
      }
      if (dto.sourceInventoryLocationId) {
        await this.requireLocation(
          manager,
          organizationId,
          dto.sourceInventoryLocationId,
        );
      }
      if (vehicle) {
        await this.assertVehicleFree(manager, organizationId, vehicle.id, null);
      }
      if (driver) {
        await this.assertDriverFree(manager, organizationId, driver.id, null);
      }

      const orders = await this.loadOrders(
        manager,
        organizationId,
        dto.orderIds,
      );

      const dispatchNumber = await this.documentSequenceService.nextNumber(
        {
          organizationId,
          branchId: dto.branchId ?? null,
          fiscalYearId: await this.resolveActiveFiscalYearId(
            manager,
            organizationId,
          ),
          documentType: DISPATCH_DOCUMENT_TYPE,
          prefix: DISPATCH_NUMBER_PREFIX,
        },
        manager,
      );

      const dispatchRepo = manager.getRepository(DispatchEntity);
      const dispatch = await dispatchRepo.save(
        dispatchRepo.create({
          organizationId,
          branchId: dto.branchId ?? null,
          dispatchNumber,
          vehicleId: vehicle?.id ?? null,
          driverId: driver?.id ?? null,
          routeId: dto.routeId ?? null,
          sourceInventoryLocationId: dto.sourceInventoryLocationId ?? null,
          status: 'ALLOCATED',
          plannedDepartureAt: dto.plannedDepartureAt
            ? new Date(dto.plannedDepartureAt)
            : null,
          notes: dto.notes ?? null,
        }),
      );

      const stopRepo = manager.getRepository(DispatchStopEntity);
      const lineRepo = manager.getRepository(DispatchStopLineEntity);

      let stopCount = 0;
      for (const order of orders) {
        const lines = await this.orderLines(manager, organizationId, order.id);
        const allocatable = lines.filter(
          (line) => this.remainingSell(line) > 0,
        );
        if (allocatable.length === 0) {
          throw new DispatchOrderNothingToDispatchException(order.id);
        }

        stopCount += 1;
        const stop = await stopRepo.save(
          stopRepo.create({
            organizationId,
            dispatchId: dispatch.id,
            orderId: order.id,
            stopSequence: stopCount,
            status: 'PENDING',
          }),
        );

        for (const line of allocatable) {
          const allocated = this.remainingSell(line);
          const allocatedBase = await this.toBaseQuantity(
            manager,
            organizationId,
            line.item,
            line.uomId,
            allocated + Number(line.freeQuantity ?? 0),
          );
          await lineRepo.save(
            lineRepo.create({
              organizationId,
              stopId: stop.id,
              orderLineId: line.id,
              itemId: line.itemId,
              uomId: line.uomId,
              allocatedQuantity: allocated.toFixed(3),
              allocatedBaseQuantity: allocatedBase.toFixed(3),
              deliveredQuantity: '0.000',
              returnedQuantity: '0.000',
              deliveredBaseQuantity: '0.000',
              returnedBaseQuantity: '0.000',
            }),
          );
        }
      }

      if (stopCount === 0) throw new DispatchNoStopsException();

      if (vehicle) {
        vehicle.currentDriverId = driver?.id ?? null;
        await manager.getRepository(VehicleEntity).save(vehicle);
      }

      await this.audit.record(
        {
          organizationId,
          branchId: dispatch.branchId,
          userId: actor.id,
          action: DISPATCH_AUDIT_ACTIONS.CREATE,
          entityType: 'dispatch',
          entityId: dispatch.id,
          newData: {
            dispatchNumber,
            status: 'ALLOCATED',
            orderCount: stopCount,
            vehicleId: vehicle?.id ?? null,
            driverId: driver?.id ?? null,
          },
        },
        manager,
      );

      return this.buildDispatchView(manager, organizationId, dispatch.id);
    });
  }

  async update(
    organizationId: string,
    actor: OrderActor,
    id: string,
    dto: UpdateDispatchDto,
  ): Promise<DispatchEntity> {
    this.assertNotDriver(actor, 'reassign');

    return this.dataSource.transaction(async (manager) => {
      const dispatch = await this.requireDispatch(manager, organizationId, id);
      if (dispatch.status !== 'ALLOCATED') {
        throw new DispatchInvalidTransitionException(
          dispatch.status,
          'reassign',
        );
      }

      if (dto.vehicleId !== undefined) {
        const oldVehicle = dispatch.vehicleId
          ? await manager.getRepository(VehicleEntity).findOne({
              where: { id: dispatch.vehicleId, organizationId },
            })
          : null;
        const vehicle = dto.vehicleId
          ? await this.requireVehicle(manager, organizationId, dto.vehicleId)
          : null;
        if (vehicle) {
          await this.assertVehicleFree(manager, organizationId, vehicle.id, id);
        }
        if (oldVehicle) {
          oldVehicle.currentDriverId = null;
          await manager.getRepository(VehicleEntity).save(oldVehicle);
        }
        dispatch.vehicleId = vehicle?.id ?? null;
      }
      if (dto.driverId !== undefined) {
        const driver = dto.driverId
          ? await this.requireDriver(manager, organizationId, dto.driverId)
          : null;
        if (driver) {
          await this.assertDriverFree(manager, organizationId, driver.id, id);
        }
        dispatch.driverId = driver?.id ?? null;
      }
      if (dto.routeId !== undefined) {
        if (dto.routeId) {
          await this.requireRoute(manager, organizationId, dto.routeId);
        }
        dispatch.routeId = dto.routeId ?? null;
      }
      if (dto.branchId !== undefined) {
        if (dto.branchId) {
          await this.requireBranch(manager, organizationId, dto.branchId);
        }
        dispatch.branchId = dto.branchId ?? null;
      }
      if (dto.sourceInventoryLocationId !== undefined) {
        if (dto.sourceInventoryLocationId) {
          await this.requireLocation(
            manager,
            organizationId,
            dto.sourceInventoryLocationId,
          );
        }
        dispatch.sourceInventoryLocationId =
          dto.sourceInventoryLocationId ?? null;
      }
      if (dto.plannedDepartureAt !== undefined) {
        dispatch.plannedDepartureAt = dto.plannedDepartureAt
          ? new Date(dto.plannedDepartureAt)
          : null;
      }
      if (dto.notes !== undefined) dispatch.notes = dto.notes;

      if (dispatch.vehicleId) {
        const vehicle = await manager.getRepository(VehicleEntity).findOne({
          where: { id: dispatch.vehicleId, organizationId },
        });
        if (vehicle) {
          vehicle.currentDriverId = dispatch.driverId;
          await manager.getRepository(VehicleEntity).save(vehicle);
        }
      }

      const saved = await manager.getRepository(DispatchEntity).save(dispatch);
      await this.audit.record(
        {
          organizationId,
          branchId: saved.branchId,
          userId: actor.id,
          action: DISPATCH_AUDIT_ACTIONS.UPDATE,
          entityType: 'dispatch',
          entityId: saved.id,
          newData: {
            status: saved.status,
            vehicleId: saved.vehicleId,
            driverId: saved.driverId,
            sourceInventoryLocationId: saved.sourceInventoryLocationId,
          },
        },
        manager,
      );

      return this.buildDispatchView(manager, organizationId, saved.id);
    });
  }

  // ── Lifecycle: load → depart → deliver/fail → complete/cancel ------------

  async load(
    organizationId: string,
    actor: OrderActor,
    id: string,
  ): Promise<DispatchEntity> {
    this.assertNotDriver(actor, 'load');

    return this.dataSource.transaction(async (manager) => {
      const dispatch = await this.requireDispatch(manager, organizationId, id);
      if (dispatch.status !== 'ALLOCATED') {
        throw new DispatchInvalidTransitionException(dispatch.status, 'LOADED');
      }
      if (!dispatch.vehicleId || !dispatch.driverId) {
        throw new DispatchVehicleDriverRequiredException();
      }
      dispatch.status = 'LOADED';
      const saved = await manager.getRepository(DispatchEntity).save(dispatch);
      await this.audit.record(
        {
          organizationId,
          branchId: saved.branchId,
          userId: actor.id,
          action: DISPATCH_AUDIT_ACTIONS.LOAD,
          entityType: 'dispatch',
          entityId: saved.id,
          newData: { status: 'LOADED' },
        },
        manager,
      );
      return this.buildDispatchView(manager, organizationId, saved.id);
    });
  }

  /**
   * LOADED → IN_TRANSIT. Validates stock for the whole run, then posts one
   * sales invoice per stop (billing its full allocation) and stamps the
   * invoice on the stop. The invoices inherit the order salesperson for
   * attribution; CBMS push happens after this transaction commits.
   */
  async depart(
    organizationId: string,
    actor: OrderActor,
    id: string,
  ): Promise<DispatchEntity> {
    this.assertNotDriver(actor, 'depart');

    const invoiceIds = await this.dataSource.transaction(async (manager) => {
      const dispatch = await this.requireDispatch(manager, organizationId, id);
      if (dispatch.status !== 'LOADED') {
        throw new DispatchDepartureNotLoadedException(id, dispatch.status);
      }
      const locationId = dispatch.sourceInventoryLocationId;
      if (!locationId) {
        throw new DispatchDepartureNoLocationException(id);
      }

      const stops = await this.stops(manager, organizationId, id);
      await this.assertStockAvailable(
        manager,
        organizationId,
        locationId,
        stops,
      );

      const created: string[] = [];
      const stopRepo = manager.getRepository(DispatchStopEntity);
      for (const stop of stops) {
        const invoice = await this.salesInvoiceService.createAndPostForDispatch(
          manager,
          organizationId,
          actor,
          {
            salesOrderId: stop.orderId,
            branchId: dispatch.branchId ?? undefined,
            lines: stop.lines.map((line) => ({
              orderLineId: line.orderLineId,
              quantity: Number(line.allocatedQuantity),
            })),
          },
          locationId,
          dispatch.id,
        );
        stop.invoiceId = invoice.id;
        await stopRepo.save(stop);
        created.push(invoice.id);
      }

      dispatch.status = 'IN_TRANSIT';
      dispatch.departedAt = new Date();
      const saved = await manager.getRepository(DispatchEntity).save(dispatch);
      await this.audit.record(
        {
          organizationId,
          branchId: saved.branchId,
          userId: actor.id,
          action: DISPATCH_AUDIT_ACTIONS.DEPART,
          entityType: 'dispatch',
          entityId: saved.id,
          newData: {
            status: 'IN_TRANSIT',
            sourceInventoryLocationId: locationId,
            stopCount: stops.length,
          },
        },
        manager,
      );
      return created;
    });

    await this.salesInvoiceService.pushCbmsForInvoices(
      organizationId,
      invoiceIds,
    );
    return this.get(organizationId, actor, id);
  }

  /** Records delivery actuals (delivered and/or short-returned) for a stop. */
  async deliver(
    organizationId: string,
    actor: OrderActor,
    dispatchId: string,
    stopId: string,
    dto: DeliverStopDto,
  ): Promise<DispatchEntity> {
    await this.dataSource.transaction(async (manager) => {
      const dispatch = await this.requireDispatch(
        manager,
        organizationId,
        dispatchId,
      );
      this.assertCanOperateStop(manager, actor, dispatch);

      const stop = await this.requireStop(
        manager,
        organizationId,
        dispatchId,
        stopId,
      );
      if (stop.status !== 'PENDING') {
        throw new DispatchAlreadyResolvedException(
          stopId,
          stop.status,
          'deliver',
        );
      }
      await this.assertDeliveryEventFree(
        manager,
        organizationId,
        stopId,
        dto.deliveryEventId,
      );

      const stopLines = await this.stopLines(manager, organizationId, stop.id);
      const stopLinesByOrderLine = new Map(
        stopLines.map((line) => [line.orderLineId, line]),
      );
      this.assertLinesCoverStop(
        stopLines,
        dto.lines.map((l) => l.orderLineId),
      );

      const lineRepo = manager.getRepository(DispatchStopLineEntity);
      let anyDelivered = false;
      for (const dtoLine of dto.lines) {
        const stopLine = stopLinesByOrderLine.get(dtoLine.orderLineId)!;
        const delivered = ROUND3(dtoLine.deliveredQuantity ?? 0);
        const returned = ROUND3(dtoLine.returnedQuantity ?? 0);
        if (delivered + returned > Number(stopLine.allocatedQuantity)) {
          throw new DispatchStopQuantitiesExceededException(
            stopLine.orderLineId,
            Number(stopLine.allocatedQuantity),
          );
        }
        if (delivered > 0) anyDelivered = true;
        stopLine.deliveredQuantity = delivered.toFixed(3);
        stopLine.returnedQuantity = returned.toFixed(3);
        const factor = this.baseFactor(stopLine);
        stopLine.deliveredBaseQuantity = ROUND3(delivered * factor).toFixed(3);
        stopLine.returnedBaseQuantity = ROUND3(returned * factor).toFixed(3);
        await lineRepo.save(stopLine);
      }

      if (!anyDelivered) {
        throw new DispatchStopNothingRecordedException();
      }

      const fullyDelivered = stopLines.every(
        (line) =>
          ROUND3(Number(line.deliveredQuantity)) ===
            ROUND3(Number(line.allocatedQuantity)) &&
          Number(line.returnedQuantity) === 0,
      );
      stop.status = fullyDelivered ? 'DELIVERED' : 'PARTIAL';
      stop.deliveredAt = new Date();
      this.applyPod(stop, dto);
      if (dto.deliveryEventId) stop.deliveryEventId = dto.deliveryEventId;
      await manager.getRepository(DispatchStopEntity).save(stop);

      await this.audit.record(
        {
          organizationId,
          branchId: dispatch.branchId,
          userId: actor.id,
          action: DISPATCH_AUDIT_ACTIONS.DELIVER,
          entityType: 'dispatch_stop',
          entityId: stop.id,
          newData: { status: stop.status, dispatchId },
        },
        manager,
      );
    });

    return this.get(organizationId, actor, dispatchId);
  }

  /**
   * Marks a stop FAILED (rejected / undeliverable) and records the full
   * allocation as returned. The shortfall credit-note draft is created by
   * `complete`, once every stop is resolved (never drafted at fail time).
   */
  async fail(
    organizationId: string,
    actor: OrderActor,
    dispatchId: string,
    stopId: string,
    dto: FailStopDto,
  ): Promise<DispatchEntity> {
    await this.dataSource.transaction(async (manager) => {
      const dispatch = await this.requireDispatch(
        manager,
        organizationId,
        dispatchId,
      );
      this.assertCanOperateStop(manager, actor, dispatch);

      const stop = await this.requireStop(
        manager,
        organizationId,
        dispatchId,
        stopId,
      );
      if (stop.status !== 'PENDING') {
        throw new DispatchAlreadyResolvedException(stopId, stop.status, 'fail');
      }
      if (!stop.invoiceId) {
        throw new DispatchShortfallInvoiceMissingException(stopId);
      }
      await this.assertDeliveryEventFree(
        manager,
        organizationId,
        stopId,
        dto.deliveryEventId,
      );

      const stopLines = await this.stopLines(manager, organizationId, stop.id);
      const lineRepo = manager.getRepository(DispatchStopLineEntity);
      for (const stopLine of stopLines) {
        stopLine.deliveredQuantity = '0.000';
        stopLine.deliveredBaseQuantity = '0.000';
        stopLine.returnedQuantity = stopLine.allocatedQuantity;
        stopLine.returnedBaseQuantity = stopLine.allocatedBaseQuantity;
        await lineRepo.save(stopLine);
      }

      stop.status = 'FAILED';
      stop.deliveredAt = new Date();
      stop.failureReason = dto.failureReason;
      this.applyPod(stop, dto);
      if (dto.deliveryEventId) stop.deliveryEventId = dto.deliveryEventId;
      await manager.getRepository(DispatchStopEntity).save(stop);

      await this.audit.record(
        {
          organizationId,
          branchId: dispatch.branchId,
          userId: actor.id,
          action: DISPATCH_AUDIT_ACTIONS.FAIL,
          entityType: 'dispatch_stop',
          entityId: stop.id,
          newData: {
            status: 'FAILED',
            failureReason: dto.failureReason,
            dispatchId,
          },
        },
        manager,
      );
    });

    return this.get(organizationId, actor, dispatchId);
  }

  async complete(
    organizationId: string,
    actor: OrderActor,
    id: string,
  ): Promise<DispatchEntity> {
    this.assertNotDriver(actor, 'complete');

    return this.dataSource.transaction(async (manager) => {
      const dispatch = await this.requireDispatch(manager, organizationId, id);
      if (dispatch.status !== 'IN_TRANSIT') {
        throw new DispatchInvalidTransitionException(
          dispatch.status,
          'DELIVERED',
        );
      }
      const stops = await this.stops(manager, organizationId, id);
      const pending = stops.filter((stop) => stop.status === 'PENDING');
      if (pending.length > 0) {
        throw new DispatchCompleteStopsPendingException(pending.length);
      }

      let shortfallDrafts = 0;
      for (const stop of stops) {
        const returnLines = await this.returnLinesForStop(
          manager,
          organizationId,
          stop,
        );
        if (returnLines.length === 0) continue;
        const order = await manager.getRepository(SalesOrderEntity).findOne({
          where: { id: stop.orderId, organizationId },
        });
        if (!order) throw new DispatchOrderNotFoundException(stop.orderId);
        await this.salesReturnService.createDraftIn(
          manager,
          organizationId,
          actor.id,
          {
            partyId: order.partyId,
            branchId: dispatch.branchId ?? undefined,
            returnReason:
              stop.status === 'FAILED'
                ? (stop.failureReason ?? 'FAILED')
                : 'PARTIAL_DELIVERY',
            notes: `Dispatch ${dispatch.dispatchNumber} stop ${stop.stopSequence} (${stop.status})`,
            lines: returnLines,
          },
          { dispatchStopId: stop.id },
        );
        shortfallDrafts += 1;
      }

      dispatch.status = 'DELIVERED';
      dispatch.completedAt = new Date();
      const saved = await manager.getRepository(DispatchEntity).save(dispatch);

      if (saved.vehicleId) {
        const vehicle = await manager.getRepository(VehicleEntity).findOne({
          where: { id: saved.vehicleId, organizationId },
        });
        if (vehicle) {
          vehicle.currentDriverId = null;
          await manager.getRepository(VehicleEntity).save(vehicle);
        }
      }

      await this.audit.record(
        {
          organizationId,
          branchId: saved.branchId,
          userId: actor.id,
          action: DISPATCH_AUDIT_ACTIONS.COMPLETE,
          entityType: 'dispatch',
          entityId: saved.id,
          newData: { status: 'DELIVERED', shortfallDrafts },
        },
        manager,
      );
      return this.buildDispatchView(manager, organizationId, saved.id);
    });
  }

  /** Cancels an ALLOCATED dispatch and frees its orders for reallocation. */
  async cancel(
    organizationId: string,
    actor: OrderActor,
    id: string,
  ): Promise<DispatchEntity> {
    this.assertNotDriver(actor, 'cancel');

    return this.dataSource.transaction(async (manager) => {
      const dispatch = await this.requireDispatch(manager, organizationId, id);
      if (dispatch.status !== 'ALLOCATED') {
        throw new DispatchInvalidTransitionException(
          dispatch.status,
          'CANCELLED',
        );
      }

      dispatch.status = 'CANCELLED';
      const saved = await manager.getRepository(DispatchEntity).save(dispatch);

      await manager
        .getRepository(DispatchStopEntity)
        .softDelete({ dispatchId: saved.id });

      if (saved.vehicleId) {
        const vehicle = await manager.getRepository(VehicleEntity).findOne({
          where: { id: saved.vehicleId, organizationId },
        });
        if (vehicle) {
          vehicle.currentDriverId = null;
          await manager.getRepository(VehicleEntity).save(vehicle);
        }
      }

      await this.audit.record(
        {
          organizationId,
          branchId: saved.branchId,
          userId: actor.id,
          action: DISPATCH_AUDIT_ACTIONS.CANCEL,
          entityType: 'dispatch',
          entityId: saved.id,
          newData: { status: 'CANCELLED' },
        },
        manager,
      );
      return this.buildDispatchView(manager, organizationId, saved.id);
    });
  }

  // ── Read / reports -------------------------------------------------------

  async list(
    organizationId: string,
    actor: OrderActor,
    query: DispatchQueryDto,
  ): Promise<[DispatchEntity[], number]> {
    const qb = this.dispatchRepo
      .createQueryBuilder('dispatch')
      .leftJoinAndSelect('dispatch.vehicle', 'vehicle')
      .leftJoinAndSelect('dispatch.driver', 'driver')
      .leftJoinAndSelect('dispatch.route', 'route')
      .leftJoinAndSelect('dispatch.branch', 'branch')
      .leftJoinAndSelect('dispatch.sourceInventoryLocation', 'sourceLocation')
      .leftJoinAndSelect('dispatch.stops', 'stop')
      .where('dispatch.organizationId = :organizationId', { organizationId });

    if (actor.roleCode === DRIVER_ROLE_CODE) {
      qb.andWhere('dispatch.driverId = :actorId', { actorId: actor.id });
    }
    if (query.status) {
      qb.andWhere('dispatch.status = :status', { status: query.status });
    }
    if (query.driverId) {
      qb.andWhere('dispatch.driverId = :driverId', {
        driverId: query.driverId,
      });
    }
    if (query.vehicleId) {
      qb.andWhere('dispatch.vehicleId = :vehicleId', {
        vehicleId: query.vehicleId,
      });
    }

    const [rows, total] = await qb
      .orderBy('dispatch.dispatchNumber', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }

  async get(
    organizationId: string,
    actor: OrderActor,
    id: string,
  ): Promise<DispatchEntity> {
    return this.dataSource.transaction(async (manager) => {
      const dispatch = await this.buildDispatchView(
        manager,
        organizationId,
        id,
      );
      if (
        actor.roleCode === DRIVER_ROLE_CODE &&
        dispatch.driverId !== actor.id
      ) {
        throw new DispatchAccessDeniedException();
      }
      return dispatch;
    });
  }

  /** Pick list: per-item base quantities to draw at load time. */
  async pickList(
    organizationId: string,
    actor: OrderActor,
    id: string,
  ): Promise<unknown> {
    return this.dataSource.transaction(async (manager) => {
      const dispatch = await this.buildDispatchView(
        manager,
        organizationId,
        id,
      );
      if (
        actor.roleCode === DRIVER_ROLE_CODE &&
        dispatch.driverId !== actor.id
      ) {
        throw new DispatchAccessDeniedException();
      }
      const byItem = new Map<
        string,
        {
          itemId: string;
          itemName: string;
          itemCode: string | null;
          baseQty: number;
        }
      >();
      for (const stop of dispatch.stops) {
        for (const line of stop.lines) {
          const current = byItem.get(line.itemId) ?? {
            itemId: line.itemId,
            itemName: line.item?.name ?? '',
            itemCode: line.item?.code ?? null,
            baseQty: 0,
          };
          current.baseQty = ROUND3(
            current.baseQty + Number(line.allocatedBaseQuantity),
          );
          byItem.set(line.itemId, current);
        }
      }
      return {
        dispatchId: dispatch.id,
        dispatchNumber: dispatch.dispatchNumber,
        status: dispatch.status,
        items: [...byItem.values()].sort((a, b) =>
          a.itemName.localeCompare(b.itemName),
        ),
      };
    });
  }

  /**
   * Loading sheet: per-stop lines for the loaders (party, order number, item
   * codes, quantities) plus per-item base-quantity totals across the run.
   */
  async loadingSheet(
    organizationId: string,
    actor: OrderActor,
    id: string,
  ): Promise<unknown> {
    return this.dataSource.transaction(async (manager) => {
      const dispatch = await this.buildDispatchView(
        manager,
        organizationId,
        id,
      );
      if (
        actor.roleCode === DRIVER_ROLE_CODE &&
        dispatch.driverId !== actor.id
      ) {
        throw new DispatchAccessDeniedException();
      }
      const byItem = new Map<
        string,
        {
          itemId: string;
          itemCode: string | null;
          itemName: string;
          baseQty: number;
        }
      >();
      const stops = dispatch.stops.map((stop) => ({
        stopId: stop.id,
        stopSequence: stop.stopSequence,
        status: stop.status,
        party: stop.order?.party
          ? { id: stop.order.party.id, name: stop.order.party.name }
          : null,
        order: {
          id: stop.order?.id ?? null,
          orderNumber: stop.order?.orderNumber ?? null,
        },
        lines: stop.lines.map((line) => {
          const current = byItem.get(line.itemId) ?? {
            itemId: line.itemId,
            itemCode: line.item?.code ?? null,
            itemName: line.item?.name ?? '',
            baseQty: 0,
          };
          current.baseQty = ROUND3(
            current.baseQty + Number(line.allocatedBaseQuantity),
          );
          byItem.set(line.itemId, current);
          return {
            itemId: line.itemId,
            itemCode: line.item?.code ?? null,
            itemName: line.item?.name ?? '',
            uomCode: line.uom?.shortName ?? line.uom?.name ?? null,
            orderLineId: line.orderLineId,
            allocatedQuantity: Number(line.allocatedQuantity),
            deliveredQuantity: Number(line.deliveredQuantity),
            returnedQuantity: Number(line.returnedQuantity),
          };
        }),
        totals: {
          allocatedQuantity: ROUND3(
            stop.lines.reduce(
              (sum, line) => sum + Number(line.allocatedQuantity),
              0,
            ),
          ),
        },
      }));
      return {
        dispatchId: dispatch.id,
        dispatchNumber: dispatch.dispatchNumber,
        status: dispatch.status,
        vehicle: dispatch.vehicle
          ? {
              id: dispatch.vehicle.id,
              name: dispatch.vehicle.name,
              registrationNumber: dispatch.vehicle.registrationNumber,
            }
          : null,
        driver: dispatch.driver
          ? { id: dispatch.driver.id, fullName: dispatch.driver.fullName }
          : null,
        stops,
        items: [...byItem.values()].sort((a, b) =>
          a.itemName.localeCompare(b.itemName),
        ),
      };
    });
  }

  // ── Private helpers ------------------------------------------------------

  private assertNotDriver(actor: OrderActor, action: string): void {
    if (actor.roleCode === DRIVER_ROLE_CODE) {
      throw new DispatchDriverActionNotAllowedException(action);
    }
  }

  private remainingSell(line: SalesOrderLineEntity): number {
    return ROUND3(Number(line.quantity) - Number(line.invoicedQuantity));
  }

  private baseFactor(line: DispatchStopLineEntity): number {
    const allocated = Number(line.allocatedQuantity);
    const allocatedBase = Number(line.allocatedBaseQuantity);
    return allocated > 0 ? allocatedBase / allocated : 0;
  }

  private async requireDispatch(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<DispatchEntity> {
    const dispatch = await manager.getRepository(DispatchEntity).findOne({
      where: { id, organizationId },
    });
    if (!dispatch) throw new DispatchNotFoundException(id);
    return dispatch;
  }

  private async requireStop(
    manager: EntityManager,
    organizationId: string,
    dispatchId: string,
    stopId: string,
  ): Promise<DispatchStopEntity> {
    const stop = await manager.getRepository(DispatchStopEntity).findOne({
      where: { id: stopId, dispatchId, organizationId },
    });
    if (!stop) throw new DispatchNotFoundException(stopId);
    return stop;
  }

  private async requireVehicle(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<VehicleEntity> {
    const vehicle = await manager.getRepository(VehicleEntity).findOne({
      where: { id, organizationId },
    });
    if (!vehicle || !vehicle.isActive) {
      throw new DispatchVehicleNotFoundException(id);
    }
    return vehicle;
  }

  private async requireDriver(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<UserEntity> {
    const driver = await manager.getRepository(UserEntity).findOne({
      where: { id, organizationId },
      relations: { role: true },
    });
    if (!driver || !driver.isActive) {
      throw new DispatchDriverNotFoundException(id);
    }
    return driver;
  }

  private async requireRoute(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<RouteEntity> {
    const route = await manager.getRepository(RouteEntity).findOne({
      where: { id, organizationId },
    });
    if (!route) throw new DispatchRouteNotFoundException(id);
    return route;
  }

  private async requireBranch(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<BranchEntity> {
    const branch = await manager.getRepository(BranchEntity).findOne({
      where: { id, organizationId },
    });
    if (!branch) throw new DispatchBranchNotFoundException(id);
    return branch;
  }

  private async requireLocation(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<InventoryLocationEntity> {
    const location = await manager
      .getRepository(InventoryLocationEntity)
      .findOne({ where: { id, organizationId } });
    if (!location || !location.isActive) {
      throw new DispatchLocationNotFoundException(id);
    }
    return location;
  }

  private async assertVehicleFree(
    manager: EntityManager,
    organizationId: string,
    vehicleId: string,
    exceptDispatchId: string | null,
  ): Promise<void> {
    const qb = manager
      .getRepository(DispatchEntity)
      .createQueryBuilder('dispatch')
      .where('dispatch.organizationId = :organizationId', { organizationId })
      .andWhere('dispatch.vehicleId = :vehicleId', { vehicleId })
      .andWhere('dispatch.status IN (:...statuses)', {
        statuses: [...ACTIVE_DISPATCH_STATUSES],
      });
    if (exceptDispatchId) {
      qb.andWhere('dispatch.id <> :exceptDispatchId', { exceptDispatchId });
    }
    if ((await qb.getCount()) > 0) {
      throw new DispatchVehicleBusyException(vehicleId);
    }
  }

  private async assertDriverFree(
    manager: EntityManager,
    organizationId: string,
    driverId: string,
    exceptDispatchId: string | null,
  ): Promise<void> {
    const qb = manager
      .getRepository(DispatchEntity)
      .createQueryBuilder('dispatch')
      .where('dispatch.organizationId = :organizationId', { organizationId })
      .andWhere('dispatch.driverId = :driverId', { driverId })
      .andWhere('dispatch.status IN (:...statuses)', {
        statuses: [...ACTIVE_DISPATCH_STATUSES],
      });
    if (exceptDispatchId) {
      qb.andWhere('dispatch.id <> :exceptDispatchId', { exceptDispatchId });
    }
    if ((await qb.getCount()) > 0) {
      throw new DispatchDriverBusyException(driverId);
    }
  }

  private async loadOrders(
    manager: EntityManager,
    organizationId: string,
    orderIds: string[],
  ): Promise<SalesOrderEntity[]> {
    const uniqueIds = [...new Set(orderIds)];
    const orders = await manager.getRepository(SalesOrderEntity).find({
      where: { id: In(uniqueIds), organizationId },
    });
    if (orders.length !== uniqueIds.length) {
      const found = new Set(orders.map((o) => o.id));
      const missing = uniqueIds.find((id) => !found.has(id));
      throw new DispatchOrderNotFoundException(missing ?? uniqueIds[0]);
    }

    for (const order of orders) {
      if (order.status !== 'CONFIRMED' && order.status !== 'COMPLETED') {
        throw new DispatchOrderNotAllocatableException(order.id, order.status);
      }
      const already = await manager
        .getRepository(DispatchStopEntity)
        .createQueryBuilder('stop')
        .innerJoin('stop.dispatch', 'dispatch')
        .where('stop.organizationId = :organizationId', { organizationId })
        .andWhere('stop.orderId = :orderId', { orderId: order.id })
        .andWhere('stop."deletedAt" IS NULL')
        .andWhere('dispatch.status IN (:...statuses)', {
          statuses: [...ACTIVE_DISPATCH_STATUSES],
        })
        .getCount();
      if (already > 0) {
        throw new DispatchOrderAlreadyAllocatedException(order.id);
      }
    }
    return orders;
  }

  private async orderLines(
    manager: EntityManager,
    organizationId: string,
    orderId: string,
  ): Promise<SalesOrderLineEntity[]> {
    return manager
      .getRepository(SalesOrderLineEntity)
      .createQueryBuilder('line')
      .leftJoinAndSelect('line.item', 'item')
      .leftJoinAndSelect('line.uom', 'uom')
      .where('line.organizationId = :organizationId', { organizationId })
      .andWhere('line.orderId = :orderId', { orderId })
      .orderBy('line.lineNo', 'ASC')
      .getMany();
  }

  private async stops(
    manager: EntityManager,
    organizationId: string,
    dispatchId: string,
  ): Promise<DispatchStopEntity[]> {
    return manager
      .getRepository(DispatchStopEntity)
      .createQueryBuilder('stop')
      .leftJoinAndSelect('stop.order', 'order')
      .leftJoinAndSelect('stop.lines', 'line')
      .where('stop.organizationId = :organizationId', { organizationId })
      .andWhere('stop.dispatchId = :dispatchId', { dispatchId })
      .orderBy('stop.stopSequence', 'ASC')
      .getMany();
  }

  private async stopLines(
    manager: EntityManager,
    organizationId: string,
    stopId: string,
  ): Promise<DispatchStopLineEntity[]> {
    return manager
      .getRepository(DispatchStopLineEntity)
      .createQueryBuilder('line')
      .where('line.organizationId = :organizationId', { organizationId })
      .andWhere('line.stopId = :stopId', { stopId })
      .orderBy('line.itemId', 'ASC')
      .getMany();
  }

  private assertLinesCoverStop(
    stopLines: DispatchStopLineEntity[],
    dtoOrderLineIds: string[],
  ): void {
    const dtoSet = new Set(dtoOrderLineIds);
    if (
      stopLines.length !== dtoOrderLineIds.length ||
      stopLines.some((line) => !dtoSet.has(line.orderLineId))
    ) {
      throw new DispatchStopLineMismatchException();
    }
  }

  private async assertDeliveryEventFree(
    manager: EntityManager,
    organizationId: string,
    stopId: string,
    eventId: string | undefined,
  ): Promise<void> {
    if (!eventId) return;
    const existing = await manager.getRepository(DispatchStopEntity).findOne({
      where: { organizationId, deliveryEventId: eventId },
    });
    if (existing && existing.id !== stopId) {
      throw new DispatchDeliveryEventMismatchException(eventId);
    }
  }

  private applyPod(
    stop: DispatchStopEntity,
    dto: DeliverStopDto | FailStopDto,
  ): void {
    stop.podReceiverName = dto.podReceiverName ?? null;
    stop.podSignaturePhotoKey = dto.podSignaturePhotoKey ?? null;
    stop.podGpsLatitude =
      dto.podGpsLatitude !== undefined ? dto.podGpsLatitude.toFixed(6) : null;
    stop.podGpsLongitude =
      dto.podGpsLongitude !== undefined ? dto.podGpsLongitude.toFixed(6) : null;
    stop.podNotes = dto.podNotes ?? null;
  }

  /** Builds the credit-note lines from the stop's depart invoice lines. */
  private async returnLinesForStop(
    manager: EntityManager,
    organizationId: string,
    stop: DispatchStopEntity,
  ): Promise<Array<{ sourceSalesInvoiceLineId: string; quantity: number }>> {
    if (!stop.invoiceId) {
      throw new DispatchDepartureNoLocationException(stop.dispatchId);
    }
    const invoiceLines = await manager
      .getRepository(SalesInvoiceLineEntity)
      .find({ where: { invoiceId: stop.invoiceId } });

    const invoiceLineByOrderLine = new Map(
      invoiceLines.map((line) => [line.sourceSalesOrderLineId, line]),
    );
    const stopLines = await this.stopLines(manager, organizationId, stop.id);
    const result: Array<{
      sourceSalesInvoiceLineId: string;
      quantity: number;
    }> = [];
    for (const stopLine of stopLines) {
      const invoiceLine = invoiceLineByOrderLine.get(stopLine.orderLineId);
      if (!invoiceLine) {
        throw new DispatchStopLineNotFoundException(
          stop.id,
          stopLine.orderLineId,
        );
      }
      const returned = ROUND3(Number(stopLine.returnedQuantity));
      if (returned > 0) {
        result.push({
          sourceSalesInvoiceLineId: invoiceLine.id,
          quantity: returned,
        });
      }
    }
    return result;
  }

  /** Aggregates the required base quantities per item across the run. */
  private async assertStockAvailable(
    manager: EntityManager,
    organizationId: string,
    locationId: string,
    stops: DispatchStopEntity[],
  ): Promise<void> {
    const required = new Map<string, number>();
    for (const stop of stops) {
      for (const line of stop.lines) {
        required.set(
          line.itemId,
          ROUND3(
            (required.get(line.itemId) ?? 0) +
              Number(line.allocatedBaseQuantity),
          ),
        );
      }
    }

    const rows = await manager
      .getRepository(InventoryBalanceEntity)
      .createQueryBuilder('balance')
      .select('balance.itemId', 'itemId')
      .addSelect('SUM(balance.quantity)', 'onHand')
      .where('balance.organizationId = :organizationId', { organizationId })
      .andWhere('balance.locationId = :locationId', { locationId })
      .andWhere('balance.itemId IN (:...itemIds)', {
        itemIds: [...required.keys()],
      })
      .groupBy('balance.itemId')
      .getRawMany<{ itemId: string; onHand: string }>();

    const onHandByItem = new Map(
      rows.map((row) => [row.itemId, Number(row.onHand)]),
    );

    for (const [itemId, need] of required) {
      const onHand = onHandByItem.get(itemId) ?? 0;
      if (ROUND3(onHand) < need) {
        const item = await manager.getRepository(ItemEntity).findOne({
          where: { id: itemId, organizationId },
        });
        throw new DispatchStockInsufficientException(
          item?.code ?? item?.name ?? itemId,
          ROUND3(onHand),
          need,
        );
      }
    }
  }

  private async resolveActiveFiscalYearId(
    manager: EntityManager,
    organizationId: string,
  ): Promise<string | null> {
    const fiscalYear = await manager.getRepository(FiscalYearEntity).findOne({
      where: { organizationId, isActive: true, isClosed: false },
      order: { startDate: 'DESC' },
    });
    return fiscalYear?.id ?? null;
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

    if (!conversion) {
      return ROUND3(quantity);
    }
    return ROUND3(Number(quantity) * Number(conversion.conversionFactor));
  }

  private assertCanOperateStop(
    manager: EntityManager,
    actor: OrderActor,
    dispatch: DispatchEntity,
  ): void {
    if (dispatch.status !== 'IN_TRANSIT') {
      throw new DispatchInvalidTransitionException(
        dispatch.status,
        'stop delivery',
      );
    }
    if (actor.roleCode === DRIVER_ROLE_CODE && dispatch.driverId !== actor.id) {
      throw new DispatchAccessDeniedException();
    }
  }

  private async buildDispatchView(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<DispatchEntity> {
    const dispatch = await manager
      .getRepository(DispatchEntity)
      .createQueryBuilder('dispatch')
      .leftJoinAndSelect('dispatch.vehicle', 'vehicle')
      .leftJoinAndSelect('dispatch.driver', 'driver')
      .leftJoinAndSelect('dispatch.route', 'route')
      .leftJoinAndSelect('dispatch.branch', 'branch')
      .leftJoinAndSelect('dispatch.sourceInventoryLocation', 'sourceLocation')
      .leftJoinAndSelect('dispatch.stops', 'stop')
      .leftJoinAndSelect('stop.order', 'order')
      .leftJoinAndSelect('order.party', 'party')
      .leftJoinAndSelect('stop.invoice', 'invoice')
      .leftJoinAndSelect('stop.lines', 'line')
      .leftJoinAndSelect('line.item', 'item')
      .leftJoinAndSelect('line.uom', 'uom')
      .where('dispatch.organizationId = :organizationId', { organizationId })
      .andWhere('dispatch.id = :id', { id })
      .orderBy('stop.stopSequence', 'ASC')
      .addOrderBy('line.itemId', 'ASC')
      .getOne();
    if (!dispatch) throw new DispatchNotFoundException(id);
    return dispatch;
  }
}
