import { DataSource } from 'typeorm';
import { InventoryLocationService } from './inventory-location.service';
import {
  InventoryLocationCodeAlreadyUsedException,
  InventoryLocationNotFoundException,
} from './inventory.errors';
import { SALESMAN_USER_ID } from '../testing/field-test.harness';
import {
  beginTestTransaction,
  createInventoryTestingModule,
  endTestTransaction,
  seedInventoryBaseline,
  TEST_ORG_ID,
  type TestTransaction,
} from '../testing/inventory-test.harness';
import { createTestDataSource } from '../testing/test-db';

describe('InventoryLocationService', () => {
  let dataSource: DataSource;
  let service: InventoryLocationService;
  let tx: TestTransaction;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedInventoryBaseline(dataSource);
    const module = await createInventoryTestingModule(dataSource);
    service = module.get(InventoryLocationService);
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

  it('creates a default location and lists it first', async () => {
    const loc = await service.createLocation(
      TEST_ORG_ID,
      {
        name: 'Main Godown',
        code: 'GODOWN-1',
        locationType: 'GODOWN',
        isDefault: true,
      },
      SALESMAN_USER_ID,
    );

    expect(loc.code).toBe('GODOWN-1');
    expect(loc.isDefault).toBe(true);

    const [rows] = await service.listLocations(TEST_ORG_ID, {
      page: 1,
      limit: 10,
    });
    expect(rows[0].id).toBe(loc.id);
  });

  it('rejects a duplicate location code', async () => {
    await service.createLocation(
      TEST_ORG_ID,
      { name: 'A', code: 'DUP', locationType: 'SHOP' },
      SALESMAN_USER_ID,
    );
    await expect(
      service.createLocation(
        TEST_ORG_ID,
        { name: 'B', code: 'DUP', locationType: 'SHOP' },
        SALESMAN_USER_ID,
      ),
    ).rejects.toBeInstanceOf(InventoryLocationCodeAlreadyUsedException);
  });

  it('keeps exactly one default when another is set default', async () => {
    const a = await service.createLocation(
      TEST_ORG_ID,
      { name: 'A', code: 'A', locationType: 'GODOWN', isDefault: true },
      SALESMAN_USER_ID,
    );
    const b = await service.createLocation(
      TEST_ORG_ID,
      { name: 'B', code: 'B', locationType: 'VAN', isDefault: true },
      SALESMAN_USER_ID,
    );

    const afterA = await service.getLocation(TEST_ORG_ID, a.id);
    const afterB = await service.getLocation(TEST_ORG_ID, b.id);
    expect(afterA.isDefault).toBe(false);
    expect(afterB.isDefault).toBe(true);
  });

  it('updates a location', async () => {
    const loc = await service.createLocation(
      TEST_ORG_ID,
      { name: 'Old', code: 'UPD', locationType: 'SHOP' },
      SALESMAN_USER_ID,
    );
    const updated = await service.updateLocation(
      TEST_ORG_ID,
      loc.id,
      { name: 'New', locationType: 'WAREHOUSE' },
      SALESMAN_USER_ID,
    );
    expect(updated.name).toBe('New');
    expect(updated.locationType).toBe('WAREHOUSE');
  });

  it('soft-deletes a location and hides it from reads', async () => {
    const loc = await service.createLocation(
      TEST_ORG_ID,
      { name: 'Gone', code: 'DEL', locationType: 'SHOP' },
      SALESMAN_USER_ID,
    );
    await service.deleteLocation(TEST_ORG_ID, loc.id, SALESMAN_USER_ID);

    const [rows] = await service.listLocations(TEST_ORG_ID, {
      page: 1,
      limit: 10,
    });
    expect(rows.find((r) => r.id === loc.id)).toBeUndefined();
    await expect(
      service.getLocation(TEST_ORG_ID, loc.id),
    ).rejects.toBeInstanceOf(InventoryLocationNotFoundException);
  });

  it('throws not-found for a missing location', async () => {
    await expect(
      service.getLocation(TEST_ORG_ID, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(InventoryLocationNotFoundException);
  });
});
