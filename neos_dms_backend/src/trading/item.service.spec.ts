import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { AccountEntity } from '../accounting/entities/account.entity';
import { TaxCodeEntity } from '../accounting/entities/tax-code.entity';
import { AuditService } from '../audit/audit.service';
import { PlanLimitService } from '../subscription/plan-limits/plan-limit.service';
import {
  createFakeManager,
  makeEntity,
  type FakeManager,
  type FakeRepo,
} from '../testing/accounting-fakes';
import { ItemEntity } from './entities/item.entity';
import { UomEntity } from './entities/uom.entity';
import { ItemService } from './item.service';
import {
  AccountNotFoundInOrgException,
  ItemCodeAlreadyUsedException,
  ItemNotFoundException,
  UomNotFoundException,
} from './trading.errors';

describe('ItemService', () => {
  const orgId = 'org-1';
  const actorId = 'user-1';

  let service: ItemService;
  let manager: FakeManager;
  let getRepo: ReturnType<typeof createFakeManager>['repo'];
  let itemRepo: FakeRepo<ItemEntity>;
  let audit: { record: jest.Mock };
  let planLimit: { assertSeat: jest.Mock };

  const item = (overrides: Partial<ItemEntity> = {}) =>
    makeEntity(ItemEntity, {
      id: 'item-1',
      organizationId: orgId,
      name: 'Coca Cola 1L',
      code: 'CC1L',
      sku: 'SKU-CC1L',
      baseUomId: 'uom-1',
      type: 'GOODS',
      valuationMethod: 'FIFO',
      inventoryTracking: 'QUANTITY',
      isActive: true,
      ...overrides,
    });

  beforeEach(async () => {
    const { manager: m, repo } = createFakeManager();
    manager = m;
    getRepo = repo;
    itemRepo = repo(ItemEntity);
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    planLimit = { assertSeat: jest.fn().mockResolvedValue(undefined) };
    const dataSource = {
      transaction: jest.fn((fn: (m: unknown) => unknown) => fn(manager)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ItemService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getRepositoryToken(ItemEntity), useValue: itemRepo },
        { provide: PlanLimitService, useValue: planLimit },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(ItemService);
  });

  describe('createItem', () => {
    it('creates with defaults and asserts the seat limit', async () => {
      getRepo(UomEntity).rows.push(
        makeEntity(UomEntity, { id: 'uom-1', organizationId: orgId }),
      );

      const created = await service.createItem(
        orgId,
        { name: 'Coca Cola 1L', code: 'CC1L', baseUomId: 'uom-1' },
        actorId,
      );

      expect(created).toMatchObject({
        organizationId: orgId,
        name: 'Coca Cola 1L',
        code: 'CC1L',
        type: 'GOODS',
        valuationMethod: 'FIFO',
        inventoryTracking: 'QUANTITY',
        trackExpiry: false,
        allowNegativeStock: false,
        isActive: true,
        mrp: '0',
      });
      expect(created.id).toBeDefined();
      expect(planLimit.assertSeat).toHaveBeenCalledWith(
        orgId,
        'items',
        expect.any(Number),
        manager,
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'trading.item.create' }),
        manager,
      );
    });

    it('throws when the code is already used', async () => {
      getRepo(UomEntity).rows.push(
        makeEntity(UomEntity, { id: 'uom-1', organizationId: orgId }),
      );
      itemRepo.rows.push(item());

      await expect(
        service.createItem(
          orgId,
          { name: 'Pepsi 1L', code: 'CC1L', baseUomId: 'uom-1' },
          actorId,
        ),
      ).rejects.toThrow(ItemCodeAlreadyUsedException);
      expect(itemRepo.rows).toHaveLength(1);
    });

    it('treats a soft-deleted item code as still taken (no raw DB 500)', async () => {
      getRepo(UomEntity).rows.push(
        makeEntity(UomEntity, { id: 'uom-1', organizationId: orgId }),
      );
      itemRepo.rows.push(item({ deletedAt: new Date(), code: 'CC1L' }));

      await expect(
        service.createItem(
          orgId,
          { name: 'Pepsi 1L', code: 'CC1L', baseUomId: 'uom-1' },
          actorId,
        ),
      ).rejects.toThrow(ItemCodeAlreadyUsedException);
      expect(itemRepo.rows).toHaveLength(1);
    });

    it('throws when base uom is not in the org', async () => {
      await expect(
        service.createItem(
          orgId,
          { name: 'Cola', baseUomId: 'missing' },
          actorId,
        ),
      ).rejects.toThrow(UomNotFoundException);
      expect(planLimit.assertSeat).not.toHaveBeenCalled();
    });

    it('throws when an account is not in the org', async () => {
      getRepo(UomEntity).rows.push(
        makeEntity(UomEntity, { id: 'uom-1', organizationId: orgId }),
      );

      await expect(
        service.createItem(
          orgId,
          { name: 'Cola', baseUomId: 'uom-1', salesAccountId: 'acct-missing' },
          actorId,
        ),
      ).rejects.toThrow(AccountNotFoundInOrgException);
    });
  });

  describe('listItems', () => {
    it('wires search, category, brand and isActive filters', async () => {
      const rows = [item()];
      const qb: {
        leftJoinAndSelect: jest.Mock;
        where: jest.Mock;
        andWhere: jest.Mock;
        orderBy: jest.Mock;
        skip: jest.Mock;
        take: jest.Mock;
        getManyAndCount: jest.Mock;
      } = {
        leftJoinAndSelect: jest.fn(() => qb),
        where: jest.fn(() => qb),
        andWhere: jest.fn(() => qb),
        orderBy: jest.fn(() => qb),
        skip: jest.fn(() => qb),
        take: jest.fn(() => qb),
        getManyAndCount: jest.fn(() => [rows, rows.length]),
      };
      itemRepo.createQueryBuilder.mockReturnValue(qb);

      const [result, total] = await service.listItems(orgId, {
        page: 1,
        limit: 10,
        search: 'cola',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        isActive: true,
      });

      expect(result).toBe(rows);
      expect(total).toBe(1);
      expect(qb.where).toHaveBeenCalledWith(
        'item.organizationId = :organizationId',
        { organizationId: orgId },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('item.name ILIKE :search'),
        { search: '%cola%' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'item.categoryId = :categoryId',
        {
          categoryId: 'cat-1',
        },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('item.brandId = :brandId', {
        brandId: 'brand-1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('item.isActive = :isActive', {
        isActive: true,
      });
    });
  });

  describe('getItem', () => {
    it('returns the item with relations', async () => {
      itemRepo.rows.push(item());
      const found = await service.getItem(orgId, 'item-1');
      expect(found).toMatchObject({ id: 'item-1', code: 'CC1L' });
      expect(itemRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1', organizationId: orgId },
          relations: {
            category: true,
            brand: true,
            baseUom: true,
            taxCode: true,
          },
        }),
      );
    });

    it('throws when missing', async () => {
      await expect(service.getItem(orgId, 'nope')).rejects.toThrow(
        ItemNotFoundException,
      );
    });
  });

  describe('updateItem', () => {
    it('updates fields and audits', async () => {
      getRepo(UomEntity).rows.push(
        makeEntity(UomEntity, { id: 'uom-1', organizationId: orgId }),
      );
      itemRepo.rows.push(item());
      const updated = await service.updateItem(
        orgId,
        'item-1',
        { name: 'Coca Cola 1.25L', rlp: 95 },
        actorId,
      );
      expect(updated).toMatchObject({
        name: 'Coca Cola 1.25L',
        rlp: '95',
        code: 'CC1L',
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'trading.item.update' }),
        manager,
      );
    });

    it('throws when changing the code onto a used one', async () => {
      itemRepo.rows.push(item({ id: 'item-1', code: 'CC1L' }));
      itemRepo.rows.push(item({ id: 'item-2', code: 'P1L' }));
      await expect(
        service.updateItem(orgId, 'item-2', { code: 'CC1L' }, actorId),
      ).rejects.toThrow(ItemCodeAlreadyUsedException);
    });

    it('throws when missing', async () => {
      await expect(
        service.updateItem(orgId, 'nope', { name: 'X' }, actorId),
      ).rejects.toThrow(ItemNotFoundException);
    });
  });

  describe('deleteItem', () => {
    it('soft-deletes and audits', async () => {
      itemRepo.rows.push(item());
      await service.deleteItem(orgId, 'item-1', actorId);
      expect(itemRepo.rows).toHaveLength(0);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'trading.item.delete' }),
      );
    });

    it('throws when missing', async () => {
      await expect(service.deleteItem(orgId, 'nope', actorId)).rejects.toThrow(
        ItemNotFoundException,
      );
    });
  });

  it('resolves the tax code and account reference checks', async () => {
    getRepo(UomEntity).rows.push(
      makeEntity(UomEntity, { id: 'uom-1', organizationId: orgId }),
    );
    getRepo(TaxCodeEntity).rows.push(
      makeEntity(TaxCodeEntity, { id: 'tax-1', organizationId: orgId }),
    );
    getRepo(AccountEntity).rows.push(
      makeEntity(AccountEntity, { id: 'acct-1', organizationId: orgId }),
    );

    const created = await service.createItem(
      orgId,
      {
        name: 'Cola',
        baseUomId: 'uom-1',
        taxCodeId: 'tax-1',
        salesAccountId: 'acct-1',
      },
      actorId,
    );

    expect(created.taxCodeId).toBe('tax-1');
    expect(created.salesAccountId).toBe('acct-1');
  });
});
