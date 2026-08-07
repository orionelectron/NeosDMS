import { DataSource } from 'typeorm';
import { BrandEntity } from '../trading/entities/brand.entity';
import { ItemCategoryEntity } from '../trading/entities/item-category.entity';
import {
  SalesTargetDuplicateException,
  SalesTargetNotFoundException,
  SalesTargetRefNotFoundException,
  SalesTargetTypeConflictException,
  SalesTargetUserNotFoundException,
} from './field.errors';
import { SalesTargetService } from './sales-target.service';
import {
  ACCOUNTANT_USER_ID,
  beginTestTransaction,
  endTestTransaction,
  MANAGER_USER_ID,
  SALESMAN_USER_ID,
  seedHrBaseline,
  TEAMMATE_USER_ID,
  TEST_ORG_ID,
  type TestTransaction,
} from '../testing/hr-test.harness';
import { createFieldTestingModule } from '../testing/field-test.harness';
import { createTestDataSource } from '../testing/test-db';

describe('SalesTargetService', () => {
  const CATEGORY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const BRAND_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  let dataSource: DataSource;
  let service: SalesTargetService;
  let tx: TestTransaction;

  const personal = (overrides: Record<string, unknown> = {}) => ({
    userId: SALESMAN_USER_ID,
    bsYear: 2083,
    bsMonth: 4,
    targetType: 'PERSONAL' as const,
    amount: 500000,
    ...overrides,
  });

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedHrBaseline(dataSource);

    await dataSource.manager.upsert(
      ItemCategoryEntity,
      {
        id: CATEGORY_ID,
        organizationId: TEST_ORG_ID,
        parentCategoryId: null,
        name: 'Packaged Foods',
        code: 'PF',
        isActive: true,
      },
      ['id'],
    );
    await dataSource.manager.upsert(
      BrandEntity,
      {
        id: BRAND_ID,
        organizationId: TEST_ORG_ID,
        name: 'Brand X',
        isActive: true,
      },
      ['id'],
    );

    const module = await createFieldTestingModule(dataSource);
    service = module.get(SalesTargetService);
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

  describe('createTarget', () => {
    it('creates a PERSONAL target', async () => {
      const target = await service.createTarget(
        TEST_ORG_ID,
        MANAGER_USER_ID,
        personal(),
      );
      expect(target.userId).toBe(SALESMAN_USER_ID);
      expect(target.bsYear).toBe(2083);
      expect(target.bsMonth).toBe(4);
      expect(target.targetType).toBe('PERSONAL');
      expect(target.amount).toBe('500000.00');
      expect(target.categoryId).toBeNull();
      expect(target.brandId).toBeNull();
      expect(target.isActive).toBe(true);
    });

    it('creates CATEGORY and BRAND targets for the same person/period', async () => {
      await service.createTarget(TEST_ORG_ID, MANAGER_USER_ID, personal());
      const category = await service.createTarget(
        TEST_ORG_ID,
        MANAGER_USER_ID,
        personal({
          targetType: 'CATEGORY',
          categoryId: CATEGORY_ID,
          amount: 200000,
        }),
      );
      const brand = await service.createTarget(
        TEST_ORG_ID,
        MANAGER_USER_ID,
        personal({
          targetType: 'BRAND',
          brandId: BRAND_ID,
          amount: 150000,
        }),
      );
      expect(category.categoryId).toBe(CATEGORY_ID);
      expect(category.brandId).toBeNull();
      expect(brand.brandId).toBe(BRAND_ID);
      expect(brand.categoryId).toBeNull();
    });

    it('rejects a duplicate target for the same dimension', async () => {
      await service.createTarget(TEST_ORG_ID, MANAGER_USER_ID, personal());
      await expect(
        service.createTarget(TEST_ORG_ID, MANAGER_USER_ID, personal()),
      ).rejects.toThrow(SalesTargetDuplicateException);
    });

    it('rejects CATEGORY with a brandId and BRAND with a categoryId', async () => {
      await expect(
        service.createTarget(
          TEST_ORG_ID,
          MANAGER_USER_ID,
          personal({ targetType: 'CATEGORY', brandId: BRAND_ID }),
        ),
      ).rejects.toThrow(SalesTargetTypeConflictException);
      await expect(
        service.createTarget(
          TEST_ORG_ID,
          MANAGER_USER_ID,
          personal({ targetType: 'BRAND', categoryId: CATEGORY_ID }),
        ),
      ).rejects.toThrow(SalesTargetTypeConflictException);
    });

    it('rejects PERSONAL with a category or brand', async () => {
      await expect(
        service.createTarget(
          TEST_ORG_ID,
          MANAGER_USER_ID,
          personal({ categoryId: CATEGORY_ID }),
        ),
      ).rejects.toThrow(SalesTargetTypeConflictException);
    });

    it('rejects unknown category/brand refs', async () => {
      await expect(
        service.createTarget(
          TEST_ORG_ID,
          MANAGER_USER_ID,
          personal({
            targetType: 'CATEGORY',
            categoryId: '00000000-0000-4000-8000-000000000001',
          }),
        ),
      ).rejects.toThrow(SalesTargetRefNotFoundException);
    });

    it('rejects a user outside the organization', async () => {
      await expect(
        service.createTarget(
          TEST_ORG_ID,
          MANAGER_USER_ID,
          personal({ userId: '00000000-0000-4000-8000-000000000002' }),
        ),
      ).rejects.toThrow(SalesTargetUserNotFoundException);
    });
  });

  describe('listTargets scoping', () => {
    it('mine shows only the actor targets', async () => {
      await service.createTarget(TEST_ORG_ID, MANAGER_USER_ID, personal());
      await service.createTarget(TEST_ORG_ID, MANAGER_USER_ID, {
        userId: TEAMMATE_USER_ID,
        bsYear: 2083,
        bsMonth: 4,
        targetType: 'PERSONAL',
        amount: 300000,
      });
      const mine = await service.listTargets(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        {},
        'mine',
      );
      expect(mine.map((t) => t.userId)).toEqual([SALESMAN_USER_ID]);
    });

    it('team shows the manager’s reportees only', async () => {
      await service.createTarget(TEST_ORG_ID, MANAGER_USER_ID, personal());
      await service.createTarget(TEST_ORG_ID, MANAGER_USER_ID, {
        userId: TEAMMATE_USER_ID,
        bsYear: 2083,
        bsMonth: 4,
        targetType: 'PERSONAL',
        amount: 300000,
      });
      await service.createTarget(TEST_ORG_ID, MANAGER_USER_ID, {
        userId: ACCOUNTANT_USER_ID,
        bsYear: 2083,
        bsMonth: 4,
        targetType: 'PERSONAL',
        amount: 100000,
      });
      const team = await service.listTargets(
        TEST_ORG_ID,
        MANAGER_USER_ID,
        {},
        'team',
      );
      const users = team.map((t) => t.userId).sort();
      expect(users).toEqual([SALESMAN_USER_ID, TEAMMATE_USER_ID].sort());
    });

    it('all shows every target in the org', async () => {
      await service.createTarget(TEST_ORG_ID, MANAGER_USER_ID, personal());
      const all = await service.listTargets(
        TEST_ORG_ID,
        MANAGER_USER_ID,
        {},
        'all',
      );
      expect(all.length).toBe(1);
    });
  });

  describe('updateTarget / deleteTarget', () => {
    it('updates amount and isActive', async () => {
      const target = await service.createTarget(
        TEST_ORG_ID,
        MANAGER_USER_ID,
        personal(),
      );
      const updated = await service.updateTarget(
        TEST_ORG_ID,
        MANAGER_USER_ID,
        target.id,
        {
          amount: 600000,
          isActive: false,
        },
      );
      expect(updated.amount).toBe('600000.00');
      expect(updated.isActive).toBe(false);
    });

    it('soft-deletes and hides from lists', async () => {
      const target = await service.createTarget(
        TEST_ORG_ID,
        MANAGER_USER_ID,
        personal(),
      );
      await service.deleteTarget(TEST_ORG_ID, MANAGER_USER_ID, target.id);
      const mine = await service.listTargets(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        {},
        'mine',
      );
      expect(mine).toEqual([]);
    });

    it('throws when the target does not exist', async () => {
      await expect(
        service.updateTarget(
          TEST_ORG_ID,
          MANAGER_USER_ID,
          '00000000-0000-4000-8000-000000000003',
          {
            amount: 1,
          },
        ),
      ).rejects.toThrow(SalesTargetNotFoundException);
      await expect(
        service.deleteTarget(
          TEST_ORG_ID,
          MANAGER_USER_ID,
          '00000000-0000-4000-8000-000000000003',
        ),
      ).rejects.toThrow(SalesTargetNotFoundException);
    });
  });

  describe('monthlyReport', () => {
    it('groups personal/category/brand targets per salesperson', async () => {
      await service.createTarget(TEST_ORG_ID, MANAGER_USER_ID, personal());
      await service.createTarget(
        TEST_ORG_ID,
        MANAGER_USER_ID,
        personal({
          targetType: 'CATEGORY',
          categoryId: CATEGORY_ID,
          amount: 200000,
        }),
      );
      await service.createTarget(
        TEST_ORG_ID,
        MANAGER_USER_ID,
        personal({
          targetType: 'BRAND',
          brandId: BRAND_ID,
          amount: 150000,
        }),
      );

      const report = await service.monthlyReport(TEST_ORG_ID, MANAGER_USER_ID, {
        scope: 'team',
        bsYear: 2083,
        bsMonth: 4,
      });
      expect(report.bsYear).toBe(2083);
      expect(report.bsMonth).toBe(4);
      const row = report.rows.find((r) => r.userId === SALESMAN_USER_ID);
      expect(row).toBeDefined();
      expect(row!.personal).toBe('500000.00');
      expect(row!.categories).toHaveLength(1);
      expect(row!.categories[0].categoryId).toBe(CATEGORY_ID);
      expect(row!.categories[0].name).toBe('Packaged Foods');
      expect(row!.brands).toHaveLength(1);
      expect(row!.brands[0].brandId).toBe(BRAND_ID);
      expect(row!.brands[0].name).toBe('Brand X');
    });
  });
});
