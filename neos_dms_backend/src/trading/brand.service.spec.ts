import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../audit/audit.service';
import {
  createFakeManager,
  makeEntity,
  type FakeManager,
  type FakeRepo,
} from '../testing/accounting-fakes';
import { BrandService } from './brand.service';
import { BrandEntity } from './entities/brand.entity';
import {
  BrandNameAlreadyUsedException,
  BrandNotFoundException,
} from './trading.errors';

describe('BrandService', () => {
  const orgId = 'org-1';
  const actorId = 'user-1';

  let service: BrandService;
  let manager: FakeManager;
  let brandRepo: FakeRepo<BrandEntity>;
  let audit: { record: jest.Mock };

  const brand = (overrides: Partial<BrandEntity> = {}) =>
    makeEntity(BrandEntity, {
      id: 'brand-1',
      organizationId: orgId,
      name: 'Coca Cola',
      isActive: true,
      ...overrides,
    });

  beforeEach(async () => {
    const { manager: m, repo } = createFakeManager();
    manager = m;
    brandRepo = repo(BrandEntity);
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const dataSource = {
      transaction: jest.fn((fn: (m: unknown) => unknown) => fn(manager)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BrandService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getRepositoryToken(BrandEntity), useValue: brandRepo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(BrandService);
  });

  describe('createBrand', () => {
    it('creates and audits in the same transaction', async () => {
      const created = await service.createBrand(
        orgId,
        { name: 'Coca Cola' },
        actorId,
      );
      expect(created).toMatchObject({
        organizationId: orgId,
        name: 'Coca Cola',
        isActive: true,
      });
      expect(created.id).toBeDefined();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'trading.brand.create' }),
        manager,
      );
    });

    it('throws when the name is already used in the org', async () => {
      brandRepo.rows.push(brand());
      await expect(
        service.createBrand(orgId, { name: 'Coca Cola' }, actorId),
      ).rejects.toThrow(BrandNameAlreadyUsedException);
    });
  });

  describe('listBrands', () => {
    it('wires search filter and pagination', async () => {
      const rows = [brand()];
      const qb: {
        where: jest.Mock;
        andWhere: jest.Mock;
        orderBy: jest.Mock;
        skip: jest.Mock;
        take: jest.Mock;
        getManyAndCount: jest.Mock;
      } = {
        where: jest.fn(() => qb),
        andWhere: jest.fn(() => qb),
        orderBy: jest.fn(() => qb),
        skip: jest.fn(() => qb),
        take: jest.fn(() => qb),
        getManyAndCount: jest.fn(() => [rows, rows.length]),
      };
      brandRepo.createQueryBuilder.mockReturnValue(qb);

      const [result, total] = await service.listBrands(orgId, {
        page: 1,
        limit: 20,
        search: 'cola',
      });

      expect(result).toBe(rows);
      expect(total).toBe(1);
      expect(qb.where).toHaveBeenCalledWith(
        'brand.organizationId = :organizationId',
        { organizationId: orgId },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('brand.name ILIKE :search', {
        search: '%cola%',
      });
    });
  });

  describe('getBrand', () => {
    it('returns the brand', async () => {
      brandRepo.rows.push(brand());
      const found = await service.getBrand(orgId, 'brand-1');
      expect(found).toMatchObject({ id: 'brand-1', name: 'Coca Cola' });
    });

    it('throws when missing', async () => {
      await expect(service.getBrand(orgId, 'nope')).rejects.toThrow(
        BrandNotFoundException,
      );
    });
  });

  describe('updateBrand', () => {
    it('updates fields and audits', async () => {
      brandRepo.rows.push(brand());
      const updated = await service.updateBrand(
        orgId,
        'brand-1',
        { name: 'Coca-Cola' },
        actorId,
      );
      expect(updated).toMatchObject({ name: 'Coca-Cola' });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'trading.brand.update' }),
        manager,
      );
    });

    it('throws when renaming to a used name', async () => {
      brandRepo.rows.push(brand({ id: 'brand-1', name: 'Coca Cola' }));
      brandRepo.rows.push(brand({ id: 'brand-2', name: 'Pepsi' }));

      await expect(
        service.updateBrand(orgId, 'brand-2', { name: 'Coca Cola' }, actorId),
      ).rejects.toThrow(BrandNameAlreadyUsedException);
    });

    it('throws when missing', async () => {
      await expect(
        service.updateBrand(orgId, 'nope', { name: 'X' }, actorId),
      ).rejects.toThrow(BrandNotFoundException);
    });
  });

  describe('deleteBrand', () => {
    it('soft-deletes and audits', async () => {
      brandRepo.rows.push(brand());
      await service.deleteBrand(orgId, 'brand-1', actorId);
      expect(brandRepo.rows).toHaveLength(0);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'trading.brand.delete' }),
      );
    });

    it('throws when missing', async () => {
      await expect(service.deleteBrand(orgId, 'nope', actorId)).rejects.toThrow(
        BrandNotFoundException,
      );
    });
  });
});
