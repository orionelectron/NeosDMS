import { DataSource } from 'typeorm';
import { InventoryBalanceEntity } from './entities/inventory-balance.entity';
import { InventoryTransactionEntity } from './entities/inventory-transaction.entity';
import {
  InventoryInsufficientStockException,
  InventoryItemNotTrackedException,
  InventoryLocationNotFoundException,
  InventoryNegativeQuantityException,
  InventoryOpeningStockAlreadyDoneException,
  InventorySameLocationTransferException,
  InventoryTransactionNotFoundException,
} from './inventory.errors';
import { InventoryService } from './inventory.service';
import {
  BASE_UOM_ID,
  beginTestTransaction,
  BOX_UOM_ID,
  createInventoryTestingModule,
  endTestTransaction,
  GOODS_ITEM_ID,
  NEGATIVE_OK_ITEM_ID,
  seedInventoryBaseline,
  SERVICE_ITEM_ID,
  TEST_ORG_ID,
  ZERO_REORDER_ITEM_ID,
  type TestTransaction,
} from '../testing/inventory-test.harness';
import { SALESMAN_USER_ID } from '../testing/field-test.harness';
import { createTestDataSource } from '../testing/test-db';
import { InventoryLocationEntity } from './entities/inventory-location.entity';
import { InventoryLocationService } from './inventory-location.service';

describe('InventoryService', () => {
  let dataSource: DataSource;
  let service: InventoryService;
  let locationService: InventoryLocationService;
  let tx: TestTransaction;

  const LOC_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01';
  const LOC_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccc02';

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedInventoryBaseline(dataSource);

    await dataSource.manager.upsert(
      InventoryLocationEntity,
      [
        {
          id: LOC_A,
          organizationId: TEST_ORG_ID,
          branchId: null,
          name: 'Godown A',
          code: 'GA',
          locationType: 'GODOWN',
          address: null,
          notes: null,
          isDefault: true,
          isActive: true,
        },
        {
          id: LOC_B,
          organizationId: TEST_ORG_ID,
          branchId: null,
          name: 'Van B',
          code: 'VB',
          locationType: 'VAN',
          address: null,
          notes: null,
          isDefault: false,
          isActive: true,
        },
      ],
      ['id'],
    );

    const module = await createInventoryTestingModule(dataSource);
    service = module.get(InventoryService);
    locationService = module.get(InventoryLocationService);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    tx = await beginTestTransaction(dataSource);
  });

  afterEach(async () => {
    await endTestTransaction(dataSource, tx);
  });

  const opening = (overrides: Record<string, unknown> = {}) => ({
    locationId: LOC_A,
    lines: [
      { itemId: GOODS_ITEM_ID, uomId: BASE_UOM_ID, quantity: 50, unitCost: 10 },
    ],
    ...overrides,
  });

  async function balanceAt(
    locationId: string,
    itemId: string,
  ): Promise<string> {
    const row = await tx.manager.getRepository(InventoryBalanceEntity).findOne({
      where: { organizationId: TEST_ORG_ID, locationId, itemId },
    });
    return row?.quantity ?? '0';
  }

  async function avgCostAt(
    locationId: string,
    itemId: string,
  ): Promise<string> {
    const row = await tx.manager.getRepository(InventoryBalanceEntity).findOne({
      where: { organizationId: TEST_ORG_ID, locationId, itemId },
    });
    return row?.avgCost ?? '0';
  }

  it('posts opening stock and materializes the balance', async () => {
    const txn = await service.postOpening(
      TEST_ORG_ID,
      opening(),
      SALESMAN_USER_ID,
    );

    expect(txn.transactionType).toBe('opening_stock');
    expect(txn.transactionNumber).toMatch(/^000001$/);
    expect(txn.lines).toHaveLength(1);
    expect(txn.lines[0].direction).toBe('IN');
    expect(await balanceAt(LOC_A, GOODS_ITEM_ID)).toBe('50.000');
  });

  it('seeds the balance avg cost from the opening stock unit cost', async () => {
    await service.postOpening(
      TEST_ORG_ID,
      opening({ lines: [{ itemId: GOODS_ITEM_ID, uomId: BASE_UOM_ID, quantity: 50, unitCost: 10 }] }),
      SALESMAN_USER_ID,
    );
    expect(await balanceAt(LOC_A, GOODS_ITEM_ID)).toBe('50.000');
    expect(await avgCostAt(LOC_A, GOODS_ITEM_ID)).toBe('10.00');
  });

  it('converts a non-base uom to the item base uom', async () => {
    await service.postOpening(
      TEST_ORG_ID,
      opening({
        lines: [{ itemId: GOODS_ITEM_ID, uomId: BOX_UOM_ID, quantity: 2 }],
      }),
      SALESMAN_USER_ID,
    );
    expect(await balanceAt(LOC_A, GOODS_ITEM_ID)).toBe('24.000');
  });

  it('rejects opening the same item twice at a location', async () => {
    await service.postOpening(TEST_ORG_ID, opening(), SALESMAN_USER_ID);
    await expect(
      service.postOpening(TEST_ORG_ID, opening(), SALESMAN_USER_ID),
    ).rejects.toBeInstanceOf(InventoryOpeningStockAlreadyDoneException);
  });

  it('rejects non-quantity-tracked items', async () => {
    await expect(
      service.postOpening(
        TEST_ORG_ID,
        opening({
          lines: [{ itemId: SERVICE_ITEM_ID, uomId: BASE_UOM_ID, quantity: 5 }],
        }),
        SALESMAN_USER_ID,
      ),
    ).rejects.toBeInstanceOf(InventoryItemNotTrackedException);
  });

  it('rejects an OUT line on opening', async () => {
    await expect(
      service.postOpening(
        TEST_ORG_ID,
        opening({
          lines: [
            {
              itemId: GOODS_ITEM_ID,
              uomId: BASE_UOM_ID,
              quantity: 5,
              direction: 'OUT',
            },
          ],
        }),
        SALESMAN_USER_ID,
      ),
    ).rejects.toBeInstanceOf(InventoryNegativeQuantityException);
  });

  it('rejects posting to a missing location', async () => {
    await expect(
      service.postOpening(
        TEST_ORG_ID,
        opening({ locationId: '00000000-0000-0000-0000-000000000000' }),
        SALESMAN_USER_ID,
      ),
    ).rejects.toBeInstanceOf(InventoryLocationNotFoundException);
  });

  it('adjusts stock IN and OUT', async () => {
    await service.postOpening(TEST_ORG_ID, opening(), SALESMAN_USER_ID);

    await service.postAdjustment(
      TEST_ORG_ID,
      {
        locationId: LOC_A,
        lines: [
          {
            itemId: GOODS_ITEM_ID,
            uomId: BASE_UOM_ID,
            quantity: 10,
            direction: 'IN',
          },
        ],
      },
      SALESMAN_USER_ID,
    );
    expect(await balanceAt(LOC_A, GOODS_ITEM_ID)).toBe('60.000');

    await service.postAdjustment(
      TEST_ORG_ID,
      {
        locationId: LOC_A,
        lines: [
          {
            itemId: GOODS_ITEM_ID,
            uomId: BASE_UOM_ID,
            quantity: 25,
            direction: 'OUT',
          },
        ],
      },
      SALESMAN_USER_ID,
    );
    expect(await balanceAt(LOC_A, GOODS_ITEM_ID)).toBe('35.000');
  });

  it('reweights avg cost on a stock-in adjustment with a unit cost', async () => {
    await service.postOpening(
      TEST_ORG_ID,
      opening({
        lines: [
          { itemId: GOODS_ITEM_ID, uomId: BASE_UOM_ID, quantity: 50, unitCost: 10 },
        ],
      }),
      SALESMAN_USER_ID,
    );
    expect(await avgCostAt(LOC_A, GOODS_ITEM_ID)).toBe('10.00');

    await service.postAdjustment(
      TEST_ORG_ID,
      {
        locationId: LOC_A,
        lines: [
          {
            itemId: GOODS_ITEM_ID,
            uomId: BASE_UOM_ID,
            quantity: 10,
            direction: 'IN',
            unitCost: 20,
          },
        ],
      },
      SALESMAN_USER_ID,
    );
    expect(await balanceAt(LOC_A, GOODS_ITEM_ID)).toBe('60.000');
    expect(await avgCostAt(LOC_A, GOODS_ITEM_ID)).toBe('11.67');
  });

  it('defaults adjustment direction to IN', async () => {
    await service.postOpening(
      TEST_ORG_ID,
      opening({
        lines: [{ itemId: GOODS_ITEM_ID, uomId: BASE_UOM_ID, quantity: 10 }],
      }),
      SALESMAN_USER_ID,
    );
    await service.postAdjustment(
      TEST_ORG_ID,
      {
        locationId: LOC_A,
        lines: [{ itemId: GOODS_ITEM_ID, uomId: BASE_UOM_ID, quantity: 5 }],
      },
      SALESMAN_USER_ID,
    );
    expect(await balanceAt(LOC_A, GOODS_ITEM_ID)).toBe('15.000');
  });

  it('rejects an OUT that would go below zero for a guarded item', async () => {
    await service.postOpening(
      TEST_ORG_ID,
      opening({
        lines: [{ itemId: GOODS_ITEM_ID, uomId: BASE_UOM_ID, quantity: 10 }],
      }),
      SALESMAN_USER_ID,
    );

    await expect(
      service.postAdjustment(
        TEST_ORG_ID,
        {
          locationId: LOC_A,
          lines: [
            {
              itemId: GOODS_ITEM_ID,
              uomId: BASE_UOM_ID,
              quantity: 11,
              direction: 'OUT',
            },
          ],
        },
        SALESMAN_USER_ID,
      ),
    ).rejects.toBeInstanceOf(InventoryInsufficientStockException);
  });

  it('allows negative stock for an item that permits it', async () => {
    await service.postAdjustment(
      TEST_ORG_ID,
      {
        locationId: LOC_A,
        lines: [
          {
            itemId: NEGATIVE_OK_ITEM_ID,
            uomId: BASE_UOM_ID,
            quantity: 3,
            direction: 'OUT',
          },
        ],
      },
      SALESMAN_USER_ID,
    );
    expect(await balanceAt(LOC_A, NEGATIVE_OK_ITEM_ID)).toBe('-3.000');
  });

  it('transfers stock between locations', async () => {
    await service.postOpening(
      TEST_ORG_ID,
      opening({
        lines: [{ itemId: GOODS_ITEM_ID, uomId: BASE_UOM_ID, quantity: 50 }],
      }),
      SALESMAN_USER_ID,
    );

    const txn = await service.postTransfer(
      TEST_ORG_ID,
      {
        fromLocationId: LOC_A,
        toLocationId: LOC_B,
        lines: [{ itemId: GOODS_ITEM_ID, uomId: BASE_UOM_ID, quantity: 20 }],
      },
      SALESMAN_USER_ID,
    );

    expect(txn.transactionType).toBe('stock_transfer');
    expect(txn.locationId).toBe(LOC_A);
    expect(txn.toLocationId).toBe(LOC_B);
    expect(await balanceAt(LOC_A, GOODS_ITEM_ID)).toBe('30.000');
    expect(await balanceAt(LOC_B, GOODS_ITEM_ID)).toBe('20.000');
  });

  it('rejects transferring more than available', async () => {
    await service.postOpening(
      TEST_ORG_ID,
      opening({
        lines: [{ itemId: GOODS_ITEM_ID, uomId: BASE_UOM_ID, quantity: 5 }],
      }),
      SALESMAN_USER_ID,
    );

    await expect(
      service.postTransfer(
        TEST_ORG_ID,
        {
          fromLocationId: LOC_A,
          toLocationId: LOC_B,
          lines: [{ itemId: GOODS_ITEM_ID, uomId: BASE_UOM_ID, quantity: 6 }],
        },
        SALESMAN_USER_ID,
      ),
    ).rejects.toBeInstanceOf(InventoryInsufficientStockException);
  });

  it('rejects a same-location transfer', async () => {
    await expect(
      service.postTransfer(
        TEST_ORG_ID,
        {
          fromLocationId: LOC_A,
          toLocationId: LOC_A,
          lines: [{ itemId: GOODS_ITEM_ID, uomId: BASE_UOM_ID, quantity: 1 }],
        },
        SALESMAN_USER_ID,
      ),
    ).rejects.toBeInstanceOf(InventorySameLocationTransferException);
  });

  it('lists transactions filtered by type and location', async () => {
    await service.postOpening(TEST_ORG_ID, opening(), SALESMAN_USER_ID);
    await service.postAdjustment(
      TEST_ORG_ID,
      {
        locationId: LOC_A,
        lines: [
          {
            itemId: GOODS_ITEM_ID,
            uomId: BASE_UOM_ID,
            quantity: 5,
            direction: 'IN',
          },
        ],
      },
      SALESMAN_USER_ID,
    );

    const [byType, byTypeTotal] = await service.listTransactions(TEST_ORG_ID, {
      page: 1,
      limit: 10,
      type: 'opening_stock',
    });
    expect(byTypeTotal).toBe(1);
    expect(byType[0].transactionType).toBe('opening_stock');

    const [all] = await service.listTransactions(TEST_ORG_ID, {
      page: 1,
      limit: 10,
      locationId: LOC_A,
    });
    expect(all.length).toBe(2);
  });

  it('gets a transaction with its lines', async () => {
    const txn = await service.postOpening(
      TEST_ORG_ID,
      opening(),
      SALESMAN_USER_ID,
    );
    const got = await service.getTransaction(TEST_ORG_ID, txn.id);
    expect(got.id).toBe(txn.id);
    expect(got.lines).toHaveLength(1);
    expect(got.lines[0].item.name).toBe('Goods Item');
  });

  it('throws not-found for a missing transaction', async () => {
    await expect(
      service.getTransaction(
        TEST_ORG_ID,
        '00000000-0000-0000-0000-000000000000',
      ),
    ).rejects.toBeInstanceOf(InventoryTransactionNotFoundException);
  });

  it('lists balances and hides zero rows unless requested', async () => {
    await service.postOpening(
      TEST_ORG_ID,
      opening({
        lines: [{ itemId: GOODS_ITEM_ID, uomId: BASE_UOM_ID, quantity: 10 }],
      }),
      SALESMAN_USER_ID,
    );

    const [rows, total] = await service.listBalances(TEST_ORG_ID, {
      page: 1,
      limit: 10,
    });
    expect(total).toBe(1);
    expect(rows[0].item.name).toBe('Goods Item');

    await service.postAdjustment(
      TEST_ORG_ID,
      {
        locationId: LOC_A,
        lines: [
          {
            itemId: GOODS_ITEM_ID,
            uomId: BASE_UOM_ID,
            quantity: 10,
            direction: 'OUT',
          },
        ],
      },
      SALESMAN_USER_ID,
    );

    const [, hiddenTotal] = await service.listBalances(TEST_ORG_ID, {
      page: 1,
      limit: 10,
    });
    expect(hiddenTotal).toBe(0);

    const [shown, shownTotal] = await service.listBalances(TEST_ORG_ID, {
      page: 1,
      limit: 10,
      includeZero: true,
    });
    expect(shownTotal).toBe(1);
    expect(shown[0].quantity).toBe('0.000');
  });

  it('reports low stock across locations including unstocked items', async () => {
    await service.postOpening(
      TEST_ORG_ID,
      opening({
        lines: [{ itemId: GOODS_ITEM_ID, uomId: BASE_UOM_ID, quantity: 5 }],
      }),
      SALESMAN_USER_ID,
    );

    const [rows, total] = await service.lowStock(TEST_ORG_ID, {
      page: 1,
      limit: 100,
    });

    const goodsRow = rows.find(
      (r) => r.itemId === GOODS_ITEM_ID && r.locationId === LOC_A,
    );
    expect(goodsRow).toBeDefined();
    expect(goodsRow!.onHand).toBe(5);
    expect(goodsRow!.reorderLevel).toBe(10);

    const unstocked = rows.find((r) => r.itemId === NEGATIVE_OK_ITEM_ID);
    expect(unstocked).toBeDefined();
    expect(unstocked!.onHand).toBe(0);
    expect(unstocked!.locationId).toBeNull();

    expect(rows.find((r) => r.itemId === ZERO_REORDER_ITEM_ID)).toBeUndefined();
    expect(rows.find((r) => r.itemId === SERVICE_ITEM_ID)).toBeUndefined();
    expect(rows.every((r) => r.reorderLevel > 0)).toBe(true);

    expect(total).toBeGreaterThanOrEqual(2);
  });

  it('keeps balances in sync after chained moves', async () => {
    await service.postOpening(
      TEST_ORG_ID,
      opening({
        lines: [{ itemId: GOODS_ITEM_ID, uomId: BASE_UOM_ID, quantity: 100 }],
      }),
      SALESMAN_USER_ID,
    );
    await service.postTransfer(
      TEST_ORG_ID,
      {
        fromLocationId: LOC_A,
        toLocationId: LOC_B,
        lines: [{ itemId: GOODS_ITEM_ID, uomId: BASE_UOM_ID, quantity: 30 }],
      },
      SALESMAN_USER_ID,
    );
    await service.postAdjustment(
      TEST_ORG_ID,
      {
        locationId: LOC_B,
        lines: [
          {
            itemId: GOODS_ITEM_ID,
            uomId: BASE_UOM_ID,
            quantity: 5,
            direction: 'OUT',
          },
        ],
      },
      SALESMAN_USER_ID,
    );

    expect(await balanceAt(LOC_A, GOODS_ITEM_ID)).toBe('70.000');
    expect(await balanceAt(LOC_B, GOODS_ITEM_ID)).toBe('25.000');

    const [txns, total] = await service.listTransactions(TEST_ORG_ID, {
      page: 1,
      limit: 10,
    });
    expect(total).toBe(3);
    expect(
      txns.every((t: InventoryTransactionEntity) => t.status === 'POSTED'),
    ).toBe(true);
  });

  it('creates locations via the location service used by the same module', async () => {
    const loc = await locationService.createLocation(
      TEST_ORG_ID,
      { name: 'Field Van', code: 'FV', locationType: 'VAN' },
      SALESMAN_USER_ID,
    );
    const [rows, total] = await locationService.listLocations(TEST_ORG_ID, {
      page: 1,
      limit: 10,
    });
    expect(total).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.id === loc.id)).toBe(true);
  });
});
