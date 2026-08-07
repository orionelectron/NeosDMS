import { DataSource } from 'typeorm';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { SalesOrderService } from './sales-order.service';
import {
  ACCOUNTANT_USER_ID,
  BASE_UOM_ID,
  beginTestTransaction,
  BOX_UOM_ID,
  CASE_UOM_ID,
  CUSTOMER_PARTY_ID,
  createSalesOrderTestingModule,
  endTestTransaction,
  GOODS_ITEM_ID,
  MANAGER_USER_ID,
  NON_CUSTOMER_PARTY_ID,
  SALESMAN_USER_ID,
  seedHrBaseline,
  seedSalesOrderBaseline,
  seedSalesOrderParties,
  TEAMMATE_USER_ID,
  TEST_LOCATION_ID,
  TEST_ORG_ID,
  type TestTransaction,
} from '../testing/sales-order-test.harness';
import { createTestDataSource } from '../testing/test-db';
import {
  SalesOrderAccessDeniedException,
  SalesOrderCustomerNotFoundException,
  SalesOrderInvalidTransitionException,
  SalesOrderItemNotFoundException,
  SalesOrderUomConversionNotFoundException,
  SalesOrderUomNotFoundException,
  SalesOrderZeroQuantityException,
} from './sales.errors';

describe('SalesOrderService', () => {
  let dataSource: DataSource;
  let service: SalesOrderService;
  let tx: TestTransaction;

  const salesman = () => ({ id: SALESMAN_USER_ID, roleCode: null });
  const teammate = () => ({ id: TEAMMATE_USER_ID, roleCode: null });
  const accountant = () => ({ id: ACCOUNTANT_USER_ID, roleCode: null });
  const manager = () => ({ id: MANAGER_USER_ID, roleCode: 'manager' });
  const admin = () => ({ id: MANAGER_USER_ID, roleCode: 'admin' });

  const goodsLine = (overrides: Record<string, unknown> = {}) => ({
    itemId: GOODS_ITEM_ID,
    uomId: BASE_UOM_ID,
    quantity: 10,
    ...overrides,
  });

  const orderDto = (overrides: Record<string, unknown> = {}) => ({
    partyId: CUSTOMER_PARTY_ID,
    lines: [goodsLine()],
    ...overrides,
  });

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedHrBaseline(dataSource);
    await seedSalesOrderBaseline(dataSource);
    const module = await createSalesOrderTestingModule(dataSource);
    service = module.get(SalesOrderService);
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

  describe('create', () => {
    it('creates a draft with defaults (salesperson, price, totals)', async () => {
      const order = await service.create(
        TEST_ORG_ID,
        salesman(),
        orderDto({ customerRemarks: 'Deliver at the back gate' }),
      );
      expect(order.status).toBe('DRAFT');
      expect(order.salespersonId).toBe(SALESMAN_USER_ID);
      expect(order.orderNumber.length).toBeGreaterThan(0);
      expect(order.partyId).toBe(CUSTOMER_PARTY_ID);
      expect(order.total).toBe('1000.00');
      expect(order.discountAmount).toBe('0.00');
      expect(order.customerRemarks).toBe('Deliver at the back gate');
      expect(order.lines).toHaveLength(1);
      expect(order.lines[0].unitPrice).toBe('100.00');
      expect(order.lines[0].quantity).toBe('10.000');
      expect(order.lines[0].freeQuantity).toBe('0.000');
      expect(order.lines[0].baseQuantity).toBe('10.000');
      expect(order.lines[0].lineTotal).toBe('1000.00');
    });

    it('converts sell uom to base quantity and prices per sell unit', async () => {
      const order = await service.create(
        TEST_ORG_ID,
        salesman(),
        orderDto({
          lines: [
            goodsLine({ uomId: BOX_UOM_ID, quantity: 2, unitPrice: 120 }),
          ],
        }),
      );
      expect(order.lines[0].quantity).toBe('2.000');
      expect(order.lines[0].baseQuantity).toBe('24.000');
      expect(order.lines[0].lineTotal).toBe('240.00');
      expect(order.total).toBe('240.00');
    });

    it('bills only the quantity while base quantity covers free units', async () => {
      const order = await service.create(
        TEST_ORG_ID,
        salesman(),
        orderDto({
          lines: [
            goodsLine({
              uomId: BOX_UOM_ID,
              quantity: 2,
              freeQuantity: 1,
              unitPrice: 120,
            }),
          ],
        }),
      );
      expect(order.lines[0].quantity).toBe('2.000');
      expect(order.lines[0].freeQuantity).toBe('1.000');
      expect(order.lines[0].baseQuantity).toBe('36.000');
      expect(order.lines[0].lineTotal).toBe('240.00');
      expect(order.total).toBe('240.00');
    });

    it('applies percent discount then header fixed discount (floor 0)', async () => {
      const order = await service.create(
        TEST_ORG_ID,
        salesman(),
        orderDto({
          discountAmount: 100,
          lines: [goodsLine({ discountPercent: 10 })],
        }),
      );
      expect(order.lines[0].lineTotal).toBe('900.00');
      expect(order.discountAmount).toBe('100.00');
      expect(order.total).toBe('800.00');
    });

    it('clamps the header discount so total never goes negative', async () => {
      const order = await service.create(
        TEST_ORG_ID,
        salesman(),
        orderDto({ discountAmount: 5000 }),
      );
      expect(order.total).toBe('0.00');
    });

    it('allows a purely-free giveaway line (qty 0, free > 0)', async () => {
      const order = await service.create(
        TEST_ORG_ID,
        salesman(),
        orderDto({ lines: [goodsLine({ quantity: 0, freeQuantity: 5 })] }),
      );
      expect(order.lines[0].lineTotal).toBe('0.00');
      expect(order.lines[0].baseQuantity).toBe('5.000');
      expect(order.total).toBe('0.00');
    });

    it('rejects a line with no billed and no free units', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          salesman(),
          orderDto({ lines: [goodsLine({ quantity: 0 })] }),
        ),
      ).rejects.toThrow(SalesOrderZeroQuantityException);
    });

    it('rejects a party that is not an active customer', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          salesman(),
          orderDto({ partyId: NON_CUSTOMER_PARTY_ID }),
        ),
      ).rejects.toThrow(SalesOrderCustomerNotFoundException);
    });

    it('rejects unknown items and uoms', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          salesman(),
          orderDto({
            lines: [
              goodsLine({ itemId: '00000000-0000-4000-8000-000000000001' }),
            ],
          }),
        ),
      ).rejects.toThrow(SalesOrderItemNotFoundException);
      await expect(
        service.create(
          TEST_ORG_ID,
          salesman(),
          orderDto({
            lines: [
              goodsLine({ uomId: '00000000-0000-4000-8000-000000000002' }),
            ],
          }),
        ),
      ).rejects.toThrow(SalesOrderUomNotFoundException);
    });

    it('rejects a sell uom with no conversion to the base uom', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          salesman(),
          orderDto({ lines: [goodsLine({ uomId: CASE_UOM_ID })] }),
        ),
      ).rejects.toThrow(SalesOrderUomConversionNotFoundException);
    });

    it('lets a manager order on behalf of a reportee', async () => {
      const order = await service.create(
        TEST_ORG_ID,
        manager(),
        orderDto({ salespersonId: SALESMAN_USER_ID }),
      );
      expect(order.salespersonId).toBe(SALESMAN_USER_ID);
    });

    it('rejects assigning another salesperson by a non-manager', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          accountant(),
          orderDto({ salespersonId: SALESMAN_USER_ID }),
        ),
      ).rejects.toThrow(SalesOrderAccessDeniedException);
    });
  });

  describe('update', () => {
    it('replaces lines and recomputes totals on a draft', async () => {
      const created = await service.create(TEST_ORG_ID, salesman(), orderDto());
      const updated = await service.update(
        TEST_ORG_ID,
        salesman(),
        created.id,
        {
          lines: [
            goodsLine({ quantity: 5, unitPrice: 100, discountPercent: 20 }),
          ],
          discountAmount: 50,
          notes: 'revised',
          customerRemarks: 'Leave with the store manager',
        },
      );
      expect(updated.lines).toHaveLength(1);
      expect(updated.lines[0].quantity).toBe('5.000');
      expect(updated.lines[0].lineTotal).toBe('400.00');
      expect(updated.discountAmount).toBe('50.00');
      expect(updated.total).toBe('350.00');
      expect(updated.notes).toBe('revised');
      expect(updated.customerRemarks).toBe('Leave with the store manager');
    });

    it('rejects updating a confirmed order', async () => {
      const created = await service.create(TEST_ORG_ID, salesman(), orderDto());
      await service.confirm(TEST_ORG_ID, salesman(), created.id);
      await expect(
        service.update(TEST_ORG_ID, salesman(), created.id, { notes: 'nope' }),
      ).rejects.toThrow(SalesOrderInvalidTransitionException);
    });
  });

  describe('confirm / complete / cancel', () => {
    it('confirms a draft and reports insufficient stock (free units included)', async () => {
      await dataSource.manager.save(
        dataSource.manager.create(InventoryBalanceEntity, {
          organizationId: TEST_ORG_ID,
          locationId: TEST_LOCATION_ID,
          itemId: GOODS_ITEM_ID,
          quantity: '20.000',
        }),
      );
      const created = await service.create(
        TEST_ORG_ID,
        salesman(),
        orderDto({ lines: [goodsLine({ uomId: BOX_UOM_ID, quantity: 3 })] }),
      );
      const { order, stockWarnings } = await service.confirm(
        TEST_ORG_ID,
        salesman(),
        created.id,
      );
      expect(order.status).toBe('CONFIRMED');
      expect(stockWarnings).toHaveLength(1);
      expect(stockWarnings[0]).toMatchObject({
        itemId: GOODS_ITEM_ID,
        itemName: 'Cold Drink',
        onHand: 20,
        ordered: 36,
      });
    });

    it('returns no warnings when stock covers the order', async () => {
      await dataSource.manager.save(
        dataSource.manager.create(InventoryBalanceEntity, {
          organizationId: TEST_ORG_ID,
          locationId: TEST_LOCATION_ID,
          itemId: GOODS_ITEM_ID,
          quantity: '20.000',
        }),
      );
      const created = await service.create(
        TEST_ORG_ID,
        salesman(),
        orderDto({ lines: [goodsLine({ quantity: 1 })] }),
      );
      const { stockWarnings } = await service.confirm(
        TEST_ORG_ID,
        salesman(),
        created.id,
      );
      expect(stockWarnings).toEqual([]);
    });

    it('completes only after confirm', async () => {
      const created = await service.create(TEST_ORG_ID, salesman(), orderDto());
      await expect(
        service.complete(TEST_ORG_ID, manager(), created.id),
      ).rejects.toThrow(SalesOrderInvalidTransitionException);
      await service.confirm(TEST_ORG_ID, salesman(), created.id);
      const done = await service.complete(TEST_ORG_ID, manager(), created.id);
      expect(done.status).toBe('COMPLETED');
      await expect(
        service.complete(TEST_ORG_ID, manager(), created.id),
      ).rejects.toThrow(SalesOrderInvalidTransitionException);
    });

    it('cancels a draft or confirmed order but not a completed one', async () => {
      const draft = await service.create(TEST_ORG_ID, salesman(), orderDto());
      expect(
        (await service.cancel(TEST_ORG_ID, salesman(), draft.id)).status,
      ).toBe('CANCELED');

      const confirmed = await service.create(
        TEST_ORG_ID,
        salesman(),
        orderDto(),
      );
      await service.confirm(TEST_ORG_ID, salesman(), confirmed.id);
      expect(
        (await service.cancel(TEST_ORG_ID, manager(), confirmed.id)).status,
      ).toBe('CANCELED');

      const done = await service.create(TEST_ORG_ID, salesman(), orderDto());
      await service.confirm(TEST_ORG_ID, salesman(), done.id);
      await service.complete(TEST_ORG_ID, manager(), done.id);
      await expect(
        service.cancel(TEST_ORG_ID, manager(), done.id),
      ).rejects.toThrow(SalesOrderInvalidTransitionException);
    });
  });

  describe('access scoping', () => {
    it('blocks another non-manager user from reading an order', async () => {
      const created = await service.create(TEST_ORG_ID, salesman(), orderDto());
      await expect(
        service.get(TEST_ORG_ID, teammate(), created.id),
      ).rejects.toThrow(SalesOrderAccessDeniedException);
    });

    it('allows the owner, their manager, and admin', async () => {
      const created = await service.create(TEST_ORG_ID, salesman(), orderDto());
      await expect(
        service.get(TEST_ORG_ID, salesman(), created.id),
      ).resolves.toBeDefined();
      await expect(
        service.get(TEST_ORG_ID, manager(), created.id),
      ).resolves.toBeDefined();
      await expect(
        service.get(TEST_ORG_ID, admin(), created.id),
      ).resolves.toBeDefined();
    });

    it('blocks updating another person’s draft', async () => {
      const created = await service.create(TEST_ORG_ID, salesman(), orderDto());
      await expect(
        service.update(TEST_ORG_ID, teammate(), created.id, { notes: 'x' }),
      ).rejects.toThrow(SalesOrderAccessDeniedException);
      await expect(
        service.update(TEST_ORG_ID, manager(), created.id, {
          notes: 'by manager',
        }),
      ).resolves.toBeDefined();
    });

    it('lists mine / team / all', async () => {
      await service.create(TEST_ORG_ID, salesman(), orderDto());
      await service.create(
        TEST_ORG_ID,
        teammate(),
        orderDto({ notes: 'teammate order' }),
      );

      const [mine] = await service.list(TEST_ORG_ID, salesman(), 'mine', {
        page: 1,
        limit: 20,
      });
      expect(mine.map((o) => o.salespersonId)).toEqual([SALESMAN_USER_ID]);

      const [team] = await service.list(TEST_ORG_ID, manager(), 'team', {
        page: 1,
        limit: 20,
      });
      expect(team.map((o) => o.salespersonId).sort()).toEqual(
        [SALESMAN_USER_ID, TEAMMATE_USER_ID].sort(),
      );

      const [all] = await service.list(TEST_ORG_ID, manager(), 'all', {
        page: 1,
        limit: 20,
      });
      expect(all).toHaveLength(2);
    });
  });
});
