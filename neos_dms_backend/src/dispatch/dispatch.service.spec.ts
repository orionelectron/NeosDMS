import { DataSource } from 'typeorm';
import { DispatchService } from './dispatch.service';
import { VehicleService } from './vehicle.service';
import { SalesOrderService } from '../sales/sales-order.service';
import { SalesInvoiceService } from '../sales/sales-invoice.service';
import { SalesReturnEntity } from '../sales/entities/sales-return.entity';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { SalesInvoiceEntity } from '../sales/entities/sales-invoice.entity';
import {
  BASE_UOM_ID,
  beginTestTransaction,
  CUSTOMER_PARTY_ID,
  createDispatchTestingModule,
  DRIVER_USER_ID,
  endTestTransaction,
  GOODS_ITEM_ID,
  MANAGER_USER_ID,
  SALESMAN_USER_ID,
  seedDispatchBaseline,
  seedSalesInvoiceBaseline,
  seedSalesOrderParties,
  seedStockAtLocation,
  TEST_LOCATION_ID,
  TEST_ORG_ID,
  VEHICLE_ID,
  VEHICLE_2_ID,
  type TestTransaction,
} from '../testing/dispatch-test.harness';
import { createTestDataSource } from '../testing/test-db';
import {
  DispatchDriverActionNotAllowedException,
  DispatchNoStopsException,
  DispatchOrderAlreadyAllocatedException,
  DispatchOrderNotAllocatableException,
  DispatchOrderNothingToDispatchException,
  DispatchStockInsufficientException,
  DispatchVehicleDriverRequiredException,
} from './dispatch.errors';

describe('DispatchService', () => {
  let dataSource: DataSource;
  let orderService: SalesOrderService;
  let invoiceService: SalesInvoiceService;
  let vehicleService: VehicleService;
  let service: DispatchService;
  let tx: TestTransaction;

  const manager = () => ({ id: MANAGER_USER_ID, roleCode: 'manager' });
  const driver = () => ({ id: DRIVER_USER_ID, roleCode: 'driver' });
  const salesman = () => ({ id: SALESMAN_USER_ID, roleCode: null });

  const orderLine = (overrides: Record<string, unknown> = {}) => ({
    itemId: GOODS_ITEM_ID,
    uomId: BASE_UOM_ID,
    quantity: 10,
    ...overrides,
  });

  const orderDto = (overrides: Record<string, unknown> = {}) => ({
    partyId: CUSTOMER_PARTY_ID,
    lines: [orderLine()],
    ...overrides,
  });

  async function confirmedOrder(): Promise<string> {
    const created = await orderService.create(
      TEST_ORG_ID,
      salesman(),
      orderDto(),
    );
    await orderService.confirm(TEST_ORG_ID, salesman(), created.id);
    return created.id;
  }

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedSalesInvoiceBaseline(dataSource);
    await seedDispatchBaseline(dataSource);
    const module = await createDispatchTestingModule(dataSource);
    orderService = module.get(SalesOrderService);
    invoiceService = module.get(SalesInvoiceService);
    vehicleService = module.get(VehicleService);
    service = module.get(DispatchService);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    tx = await beginTestTransaction(dataSource);
    await seedSalesOrderParties(dataSource);
  });

  afterEach(async () => {
    await endTestTransaction(dataSource, tx);
  });

  describe('VehicleService', () => {
    it('creates, lists, updates and soft-deletes a vehicle', async () => {
      const created = await vehicleService.create(
        TEST_ORG_ID,
        MANAGER_USER_ID,
        {
          name: 'Pickup',
          registrationNumber: 'BA 1 CHA 9999',
          vehicleType: 'pickup',
          capacityWeightKg: 500,
        },
      );
      expect(created.registrationNumber).toBe('BA 1 CHA 9999');
      expect(created.vehicleType).toBe('pickup');
      expect(created.isActive).toBe(true);

      const [rows, total] = await vehicleService.list(TEST_ORG_ID, {
        page: 1,
        limit: 20,
        search: 'Pickup',
      });
      expect(total).toBe(1);
      expect(rows[0].id).toBe(created.id);

      const updated = await vehicleService.update(
        TEST_ORG_ID,
        MANAGER_USER_ID,
        created.id,
        {
          capacityWeightKg: 800,
          isActive: false,
        },
      );
      expect(updated.capacityWeightKg).toBe('800.000');
      expect(updated.isActive).toBe(false);

      await vehicleService.remove(TEST_ORG_ID, MANAGER_USER_ID, created.id);
      await expect(
        vehicleService.get(TEST_ORG_ID, created.id),
      ).rejects.toThrow();
    });
  });

  describe('create', () => {
    it('allocates eligible orders as stops and reserves a DSP- number', async () => {
      const orderId = await confirmedOrder();
      const dispatch = await service.create(TEST_ORG_ID, manager(), {
        orderIds: [orderId],
        vehicleId: VEHICLE_ID,
        driverId: DRIVER_USER_ID,
        sourceInventoryLocationId: TEST_LOCATION_ID,
      });

      expect(dispatch.dispatchNumber).toMatch(/^DSP-\d+$/);
      expect(dispatch.status).toBe('ALLOCATED');
      expect(dispatch.vehicleId).toBe(VEHICLE_ID);
      expect(dispatch.driverId).toBe(DRIVER_USER_ID);
      expect(dispatch.stops).toHaveLength(1);
      const stop = dispatch.stops[0];
      expect(stop.orderId).toBe(orderId);
      expect(stop.stopSequence).toBe(1);
      expect(stop.lines).toHaveLength(1);
      expect(stop.lines[0].allocatedQuantity).toBe('10.000');
      expect(stop.lines[0].allocatedBaseQuantity).toBe('10.000');

      const vehicle = await vehicleService.get(TEST_ORG_ID, VEHICLE_ID);
      expect(vehicle.currentDriverId).toBe(DRIVER_USER_ID);
    });

    it('rejects orders that are not CONFIRMED/COMPLETED', async () => {
      const created = await orderService.create(
        TEST_ORG_ID,
        salesman(),
        orderDto(),
      );
      await expect(
        service.create(TEST_ORG_ID, manager(), { orderIds: [created.id] }),
      ).rejects.toThrow(DispatchOrderNotAllocatableException);
    });

    it('rejects an order already on an active dispatch', async () => {
      const orderId = await confirmedOrder();
      await service.create(TEST_ORG_ID, manager(), { orderIds: [orderId] });
      await expect(
        service.create(TEST_ORG_ID, manager(), { orderIds: [orderId] }),
      ).rejects.toThrow(DispatchOrderAlreadyAllocatedException);
    });

    it('rejects an order with nothing left to dispatch', async () => {
      const created = await orderService.create(
        TEST_ORG_ID,
        salesman(),
        orderDto({ lines: [orderLine({ quantity: 5 })] }),
      );
      const orderId = created.id;
      const order = await orderService.get(TEST_ORG_ID, salesman(), orderId);
      const orderLineId = order.lines[0].id;
      await orderService.confirm(TEST_ORG_ID, salesman(), orderId);

      await seedStockAtLocation(dataSource, GOODS_ITEM_ID, 100);
      const invoice = await invoiceService.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [{ orderLineId, quantity: 5 }],
      });
      await invoiceService.post(TEST_ORG_ID, salesman(), invoice.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });

      await expect(
        service.create(TEST_ORG_ID, manager(), { orderIds: [orderId] }),
      ).rejects.toThrow(DispatchOrderNothingToDispatchException);
    });

    it('blocks drivers from creating dispatches', async () => {
      const orderId = await confirmedOrder();
      await expect(
        service.create(TEST_ORG_ID, driver(), { orderIds: [orderId] }),
      ).rejects.toThrow(DispatchDriverActionNotAllowedException);
    });

    it('rejects when no order is eligible', async () => {
      await expect(
        service.create(TEST_ORG_ID, manager(), { orderIds: [] }),
      ).rejects.toThrow(DispatchNoStopsException);
    });
  });

  describe('lifecycle', () => {
    it('load → depart posts one invoice per stop and deducts stock', async () => {
      const orderId = await confirmedOrder();
      await seedStockAtLocation(
        dataSource,
        GOODS_ITEM_ID,
        100,
        TEST_LOCATION_ID,
        60,
      );

      const dispatch = await service.create(TEST_ORG_ID, manager(), {
        orderIds: [orderId],
        vehicleId: VEHICLE_ID,
        driverId: DRIVER_USER_ID,
        sourceInventoryLocationId: TEST_LOCATION_ID,
      });

      const loaded = await service.load(TEST_ORG_ID, manager(), dispatch.id);
      expect(loaded.status).toBe('LOADED');

      const departed = await service.depart(
        TEST_ORG_ID,
        manager(),
        dispatch.id,
      );
      expect(departed.status).toBe('IN_TRANSIT');
      expect(departed.departedAt).not.toBeNull();
      const stop = departed.stops[0];
      expect(stop.invoiceId).not.toBeNull();

      const invoice = await dataSource.manager
        .getRepository(SalesInvoiceEntity)
        .findOne({ where: { id: stop.invoiceId! } });
      expect(invoice).not.toBeNull();
      expect(invoice!.status).toBe('POSTED');
      expect(invoice!.dispatchId).toBe(dispatch.id);
      expect(invoice!.invoiceNumber).toMatch(/^INV-\d+$/);

      const balance = await dataSource.manager
        .getRepository(InventoryBalanceEntity)
        .findOne({
          where: {
            organizationId: TEST_ORG_ID,
            locationId: TEST_LOCATION_ID,
            itemId: GOODS_ITEM_ID,
          },
        });
      expect(Number(balance!.quantity)).toBe(90);
    });

    it('blocks depart when stock is insufficient', async () => {
      const orderId = await confirmedOrder();
      const dispatch = await service.create(TEST_ORG_ID, manager(), {
        orderIds: [orderId],
        vehicleId: VEHICLE_ID,
        driverId: DRIVER_USER_ID,
        sourceInventoryLocationId: TEST_LOCATION_ID,
      });
      await service.load(TEST_ORG_ID, manager(), dispatch.id);
      await dataSource.manager.getRepository(InventoryBalanceEntity).update(
        {
          organizationId: TEST_ORG_ID,
          locationId: TEST_LOCATION_ID,
          itemId: GOODS_ITEM_ID,
        },
        { quantity: '5.000' },
      );

      await expect(
        service.depart(TEST_ORG_ID, manager(), dispatch.id),
      ).rejects.toThrow(DispatchStockInsufficientException);
    });

    it('requires a vehicle and driver before loading', async () => {
      const orderId = await confirmedOrder();
      const dispatch = await service.create(TEST_ORG_ID, manager(), {
        orderIds: [orderId],
      });
      await expect(
        service.load(TEST_ORG_ID, manager(), dispatch.id),
      ).rejects.toThrow(DispatchVehicleDriverRequiredException);
    });

    it('deliver full quantity → DELIVERED; partial → PARTIAL', async () => {
      const orderId = await confirmedOrder();
      await seedStockAtLocation(
        dataSource,
        GOODS_ITEM_ID,
        100,
        TEST_LOCATION_ID,
        60,
      );
      const dispatch = await service.create(TEST_ORG_ID, manager(), {
        orderIds: [orderId],
        vehicleId: VEHICLE_ID,
        driverId: DRIVER_USER_ID,
        sourceInventoryLocationId: TEST_LOCATION_ID,
      });
      await service.load(TEST_ORG_ID, manager(), dispatch.id);
      const departed = await service.depart(
        TEST_ORG_ID,
        manager(),
        dispatch.id,
      );
      const stop = departed.stops[0];
      const line = stop.lines[0];

      const afterFull = await service.deliver(
        TEST_ORG_ID,
        driver(),
        dispatch.id,
        stop.id,
        {
          lines: [
            {
              orderLineId: line.orderLineId,
              deliveredQuantity: 10,
              returnedQuantity: 0,
            },
          ],
        },
      );
      expect(afterFull.stops[0].status).toBe('DELIVERED');
      await service.complete(TEST_ORG_ID, manager(), dispatch.id);

      const dispatch2 = await service.create(TEST_ORG_ID, manager(), {
        orderIds: [await confirmedOrder()],
        vehicleId: VEHICLE_2_ID,
        driverId: DRIVER_USER_ID,
        sourceInventoryLocationId: TEST_LOCATION_ID,
      });
      await service.load(TEST_ORG_ID, manager(), dispatch2.id);
      const departed2 = await service.depart(
        TEST_ORG_ID,
        manager(),
        dispatch2.id,
      );
      const stop2 = departed2.stops[0];
      const line2 = stop2.lines[0];

      const afterPartial = await service.deliver(
        TEST_ORG_ID,
        driver(),
        dispatch2.id,
        stop2.id,
        {
          lines: [
            {
              orderLineId: line2.orderLineId,
              deliveredQuantity: 6,
              returnedQuantity: 2,
            },
          ],
        },
      );
      expect(afterPartial.stops[0].status).toBe('PARTIAL');
      expect(afterPartial.stops[0].lines[0].deliveredQuantity).toBe('6.000');
      expect(afterPartial.stops[0].lines[0].returnedQuantity).toBe('2.000');
    });

    it('fail marks FAILED and records returned stock (draft deferred to complete)', async () => {
      const orderId = await confirmedOrder();
      await seedStockAtLocation(
        dataSource,
        GOODS_ITEM_ID,
        100,
        TEST_LOCATION_ID,
        60,
      );
      const dispatch = await service.create(TEST_ORG_ID, manager(), {
        orderIds: [orderId],
        vehicleId: VEHICLE_ID,
        driverId: DRIVER_USER_ID,
        sourceInventoryLocationId: TEST_LOCATION_ID,
      });
      await service.load(TEST_ORG_ID, manager(), dispatch.id);
      const departed = await service.depart(
        TEST_ORG_ID,
        manager(),
        dispatch.id,
      );
      const stop = departed.stops[0];

      const failed = await service.fail(
        TEST_ORG_ID,
        driver(),
        dispatch.id,
        stop.id,
        {
          failureReason: 'REJECTED',
          podNotes: 'Customer rejected the order',
        },
      );
      expect(failed.stops[0].status).toBe('FAILED');
      expect(failed.stops[0].failureReason).toBe('REJECTED');
      expect(failed.stops[0].lines[0].returnedQuantity).toBe('10.000');

      const draft = await dataSource.manager
        .getRepository(SalesReturnEntity)
        .findOne({
          where: { dispatchStopId: stop.id },
        });
      expect(draft).toBeNull();
    });

    it('complete drafts a credit note per shortfall stop (FAILED and PARTIAL)', async () => {
      const failedOrderId = await confirmedOrder();
      await seedStockAtLocation(
        dataSource,
        GOODS_ITEM_ID,
        100,
        TEST_LOCATION_ID,
        60,
      );
      const failedDispatch = await service.create(TEST_ORG_ID, manager(), {
        orderIds: [failedOrderId],
        vehicleId: VEHICLE_ID,
        driverId: DRIVER_USER_ID,
        sourceInventoryLocationId: TEST_LOCATION_ID,
      });
      await service.load(TEST_ORG_ID, manager(), failedDispatch.id);
      const failedDeparted = await service.depart(
        TEST_ORG_ID,
        manager(),
        failedDispatch.id,
      );
      const failedStop = failedDeparted.stops[0];
      await service.fail(
        TEST_ORG_ID,
        driver(),
        failedDispatch.id,
        failedStop.id,
        {
          failureReason: 'REJECTED',
        },
      );
      const beforeComplete = await dataSource.manager
        .getRepository(SalesReturnEntity)
        .findOne({ where: { dispatchStopId: failedStop.id } });
      expect(beforeComplete).toBeNull();

      const completedFailed = await service.complete(
        TEST_ORG_ID,
        manager(),
        failedDispatch.id,
      );
      expect(completedFailed.status).toBe('DELIVERED');
      const failedDraft = await dataSource.manager
        .getRepository(SalesReturnEntity)
        .findOne({ where: { dispatchStopId: failedStop.id } });
      expect(failedDraft).not.toBeNull();
      expect(failedDraft!.status).toBe('DRAFT');
      expect(failedDraft!.partyId).toBe(CUSTOMER_PARTY_ID);
      expect(failedDraft!.returnNumber).toBeNull();

      const partialOrderId = await confirmedOrder();
      await seedStockAtLocation(
        dataSource,
        GOODS_ITEM_ID,
        100,
        TEST_LOCATION_ID,
        60,
      );
      const partialDispatch = await service.create(TEST_ORG_ID, manager(), {
        orderIds: [partialOrderId],
        vehicleId: VEHICLE_2_ID,
        driverId: DRIVER_USER_ID,
        sourceInventoryLocationId: TEST_LOCATION_ID,
      });
      await service.load(TEST_ORG_ID, manager(), partialDispatch.id);
      const partialDeparted = await service.depart(
        TEST_ORG_ID,
        manager(),
        partialDispatch.id,
      );
      const partialStop = partialDeparted.stops[0];
      const partialLine = partialStop.lines[0];
      await service.deliver(
        TEST_ORG_ID,
        driver(),
        partialDispatch.id,
        partialStop.id,
        {
          lines: [
            {
              orderLineId: partialLine.orderLineId,
              deliveredQuantity: 6,
              returnedQuantity: 2,
            },
          ],
        },
      );
      await service.complete(TEST_ORG_ID, manager(), partialDispatch.id);
      const partialDraft = await dataSource.manager
        .getRepository(SalesReturnEntity)
        .findOne({ where: { dispatchStopId: partialStop.id } });
      expect(partialDraft).not.toBeNull();
      expect(partialDraft!.status).toBe('DRAFT');
    });

    it('complete requires all stops resolved, then frees the vehicle', async () => {
      const orderId = await confirmedOrder();
      await seedStockAtLocation(
        dataSource,
        GOODS_ITEM_ID,
        100,
        TEST_LOCATION_ID,
        60,
      );
      const dispatch = await service.create(TEST_ORG_ID, manager(), {
        orderIds: [orderId],
        vehicleId: VEHICLE_ID,
        driverId: DRIVER_USER_ID,
        sourceInventoryLocationId: TEST_LOCATION_ID,
      });
      await service.load(TEST_ORG_ID, manager(), dispatch.id);
      const departed = await service.depart(
        TEST_ORG_ID,
        manager(),
        dispatch.id,
      );
      const stop = departed.stops[0];
      const line = stop.lines[0];

      await service.deliver(TEST_ORG_ID, driver(), dispatch.id, stop.id, {
        lines: [{ orderLineId: line.orderLineId, deliveredQuantity: 10 }],
      });

      const completed = await service.complete(
        TEST_ORG_ID,
        manager(),
        dispatch.id,
      );
      expect(completed.status).toBe('DELIVERED');
      expect(completed.completedAt).not.toBeNull();

      const vehicle = await vehicleService.get(TEST_ORG_ID, VEHICLE_ID);
      expect(vehicle.currentDriverId).toBeNull();
    });

    it('cancel frees the order for reallocation', async () => {
      const orderId = await confirmedOrder();
      const dispatch = await service.create(TEST_ORG_ID, manager(), {
        orderIds: [orderId],
        vehicleId: VEHICLE_ID,
        driverId: DRIVER_USER_ID,
      });
      const cancelled = await service.cancel(
        TEST_ORG_ID,
        manager(),
        dispatch.id,
      );
      expect(cancelled.status).toBe('CANCELLED');

      const vehicle = await vehicleService.get(TEST_ORG_ID, VEHICLE_ID);
      expect(vehicle.currentDriverId).toBeNull();

      const reallocated = await service.create(TEST_ORG_ID, manager(), {
        orderIds: [orderId],
        vehicleId: VEHICLE_2_ID,
        driverId: DRIVER_USER_ID,
      });
      expect(reallocated.stops).toHaveLength(1);
    });
  });

  describe('scoping', () => {
    it('drivers only see their own dispatches', async () => {
      const orderId = await confirmedOrder();
      const dispatch = await service.create(TEST_ORG_ID, manager(), {
        orderIds: [orderId],
        vehicleId: VEHICLE_ID,
        driverId: DRIVER_USER_ID,
      });

      const [rows, total] = await service.list(TEST_ORG_ID, driver(), {
        page: 1,
        limit: 20,
      });
      expect(total).toBe(1);
      expect(rows[0].id).toBe(dispatch.id);

      const other = await service.create(TEST_ORG_ID, manager(), {
        orderIds: [await confirmedOrder()],
        vehicleId: VEHICLE_2_ID,
        driverId: null,
      });
      const [otherRows] = await service.list(TEST_ORG_ID, driver(), {
        page: 1,
        limit: 20,
      });
      expect(otherRows.map((row) => row.id)).not.toContain(other.id);
    });

    it('pick-list aggregates per-item base quantities', async () => {
      const orderId = await confirmedOrder();
      await seedStockAtLocation(
        dataSource,
        GOODS_ITEM_ID,
        100,
        TEST_LOCATION_ID,
        60,
      );
      const dispatch = await service.create(TEST_ORG_ID, manager(), {
        orderIds: [orderId],
        vehicleId: VEHICLE_ID,
        driverId: DRIVER_USER_ID,
        sourceInventoryLocationId: TEST_LOCATION_ID,
      });
      const pickList = (await service.pickList(
        TEST_ORG_ID,
        manager(),
        dispatch.id,
      )) as {
        dispatchId: string;
        status: string;
        items: Array<{ baseQty: number }>;
      };
      expect(pickList).toMatchObject({
        dispatchId: dispatch.id,
        status: 'ALLOCATED',
      });
      expect(pickList.items).toHaveLength(1);
      expect(pickList.items[0].baseQty).toBe(10);
    });

    it('loading-sheet lists per-stop lines with party, order number and item totals', async () => {
      const orderId = await confirmedOrder();
      await seedStockAtLocation(
        dataSource,
        GOODS_ITEM_ID,
        100,
        TEST_LOCATION_ID,
        60,
      );
      const dispatch = await service.create(TEST_ORG_ID, manager(), {
        orderIds: [orderId],
        vehicleId: VEHICLE_ID,
        driverId: DRIVER_USER_ID,
        sourceInventoryLocationId: TEST_LOCATION_ID,
      });
      const sheet = (await service.loadingSheet(
        TEST_ORG_ID,
        manager(),
        dispatch.id,
      )) as {
        dispatchId: string;
        status: string;
        stops: Array<{
          stopSequence: number;
          party: { id: string } | null;
          order: { orderNumber: string | null };
          lines: Array<{
            itemCode: string | null;
            orderLineId: string;
            allocatedQuantity: number;
          }>;
        }>;
        items: Array<{ baseQty: number }>;
      };
      expect(sheet).toMatchObject({
        dispatchId: dispatch.id,
        status: 'ALLOCATED',
      });
      expect(sheet.stops).toHaveLength(1);
      expect(sheet.stops[0].stopSequence).toBe(1);
      expect(sheet.stops[0].party?.id).toBe(CUSTOMER_PARTY_ID);
      expect(sheet.stops[0].order.orderNumber).not.toBeNull();
      expect(sheet.stops[0].lines).toHaveLength(1);
      expect(sheet.stops[0].lines[0].allocatedQuantity).toBe(10);
      expect(sheet.items).toHaveLength(1);
      expect(sheet.items[0].baseQty).toBe(10);
    });
  });
});
