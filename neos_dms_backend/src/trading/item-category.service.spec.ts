import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../audit/audit.service';
import {
  createFakeManager,
  makeEntity,
  type FakeManager,
  type FakeRepo,
} from '../testing/accounting-fakes';
import { ItemCategoryEntity } from './entities/item-category.entity';
import { ItemCategoryService } from './item-category.service';
import {
  ItemCategoryCodeAlreadyUsedException,
  ItemCategoryNotFoundException,
} from './trading.errors';

describe('ItemCategoryService', () => {
  const orgId = 'org-1';
  const actorId = 'user-1';

  let service: ItemCategoryService;
  let manager: FakeManager;
  let categoryRepo: FakeRepo<ItemCategoryEntity>;
  let audit: { record: jest.Mock };

  const category = (overrides: Partial<ItemCategoryEntity> = {}) =>
    makeEntity(ItemCategoryEntity, {
      id: 'cat-1',
      organizationId: orgId,
      name: 'Beverages',
      code: 'BEV',
      parentCategoryId: null,
      isActive: true,
      ...overrides,
    });

  beforeEach(async () => {
    const { manager: m, repo } = createFakeManager();
    manager = m;
    categoryRepo = repo(ItemCategoryEntity);
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const dataSource = {
      transaction: jest.fn((fn: (m: unknown) => unknown) => fn(manager)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ItemCategoryService,
        { provide: getDataSourceToken(), useValue: dataSource },
        {
          provide: getRepositoryToken(ItemCategoryEntity),
          useValue: categoryRepo,
        },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(ItemCategoryService);
  });

  describe('createItemCategory', () => {
    it('creates with defaults and audits in the same transaction', async () => {
      const created = await service.createItemCategory(
        orgId,
        { name: 'Beverages', code: 'BEV' },
        actorId,
      );

      expect(created).toMatchObject({
        organizationId: orgId,
        name: 'Beverages',
        code: 'BEV',
        parentCategoryId: null,
        isActive: true,
      });
      expect(created.id).toBeDefined();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'trading.item-category.create' }),
        manager,
      );
    });

    it('throws when the code is already used in the org', async () => {
      categoryRepo.rows.push(category());

      await expect(
        service.createItemCategory(
          orgId,
          { name: 'Drinks', code: 'BEV' },
          actorId,
        ),
      ).rejects.toThrow(ItemCategoryCodeAlreadyUsedException);
      expect(categoryRepo.rows).toHaveLength(1);
    });

    it('throws when the parent category is not in the org', async () => {
      await expect(
        service.createItemCategory(
          orgId,
          { name: 'Cold Drinks', parentCategoryId: 'missing' },
          actorId,
        ),
      ).rejects.toThrow(ItemCategoryNotFoundException);
    });
  });

  describe('listItemCategories', () => {
    it('wires search filter and pagination', async () => {
      const rows = [category()];
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
      categoryRepo.createQueryBuilder.mockReturnValue(qb);

      const [result, total] = await service.listItemCategories(orgId, {
        page: 2,
        limit: 10,
        search: 'bev',
      });

      expect(result).toBe(rows);
      expect(total).toBe(1);
      expect(qb.where).toHaveBeenCalledWith(
        'category.organizationId = :organizationId',
        { organizationId: orgId },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('category.name ILIKE :search'),
        { search: '%bev%' },
      );
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
    });
  });

  describe('getItemCategory', () => {
    it('returns the category with its parent relation', async () => {
      categoryRepo.rows.push(category());
      const found = await service.getItemCategory(orgId, 'cat-1');
      expect(found).toMatchObject({ id: 'cat-1', code: 'BEV' });
      expect(categoryRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cat-1', organizationId: orgId },
          relations: { parentCategory: true },
        }),
      );
    });

    it('throws when missing', async () => {
      await expect(service.getItemCategory(orgId, 'nope')).rejects.toThrow(
        ItemCategoryNotFoundException,
      );
    });
  });

  describe('updateItemCategory', () => {
    it('updates fields and audits', async () => {
      categoryRepo.rows.push(category());
      const updated = await service.updateItemCategory(
        orgId,
        'cat-1',
        { name: 'Beverages & Juices' },
        actorId,
      );
      expect(updated).toMatchObject({
        name: 'Beverages & Juices',
        code: 'BEV',
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'trading.item-category.update' }),
        manager,
      );
    });

    it('rejects self-parenting', async () => {
      categoryRepo.rows.push(category());
      await expect(
        service.updateItemCategory(
          orgId,
          'cat-1',
          { parentCategoryId: 'cat-1' },
          actorId,
        ),
      ).rejects.toThrow(ItemCategoryNotFoundException);
    });

    it('throws when missing', async () => {
      await expect(
        service.updateItemCategory(orgId, 'nope', { name: 'X' }, actorId),
      ).rejects.toThrow(ItemCategoryNotFoundException);
    });
  });

  describe('deleteItemCategory', () => {
    it('soft-deletes and audits', async () => {
      categoryRepo.rows.push(category());
      await service.deleteItemCategory(orgId, 'cat-1', actorId);
      expect(categoryRepo.rows).toHaveLength(0);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'trading.item-category.delete' }),
      );
    });

    it('throws when missing', async () => {
      await expect(
        service.deleteItemCategory(orgId, 'nope', actorId),
      ).rejects.toThrow(ItemCategoryNotFoundException);
    });
  });
});
