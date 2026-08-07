import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../audit/audit.service';
import {
  createFakeManager,
  makeEntity,
  type FakeManager,
  type FakeRepo,
} from '../testing/accounting-fakes';
import { UomEntity } from './entities/uom.entity';
import {
  UomNotFoundException,
  UomShortNameAlreadyUsedException,
} from './trading.errors';
import { UomService } from './uom.service';

describe('UomService', () => {
  const orgId = 'org-1';
  const actorId = 'user-1';

  let service: UomService;
  let manager: FakeManager;
  let uomRepo: FakeRepo<UomEntity>;
  let audit: { record: jest.Mock };

  const uom = (overrides: Partial<UomEntity> = {}) =>
    makeEntity(UomEntity, {
      id: 'uom-1',
      organizationId: orgId,
      name: 'Piece',
      shortName: 'PCS',
      isActive: true,
      ...overrides,
    });

  beforeEach(async () => {
    const { manager: m, repo } = createFakeManager();
    manager = m;
    uomRepo = repo(UomEntity);
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const dataSource = {
      transaction: jest.fn((fn: (m: unknown) => unknown) => fn(manager)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UomService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getRepositoryToken(UomEntity), useValue: uomRepo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(UomService);
  });

  describe('createUom', () => {
    it('creates and audits in the same transaction', async () => {
      const created = await service.createUom(
        orgId,
        { name: 'Piece', shortName: 'PCS' },
        actorId,
      );
      expect(created).toMatchObject({
        organizationId: orgId,
        name: 'Piece',
        shortName: 'PCS',
        isActive: true,
      });
      expect(created.id).toBeDefined();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'trading.uom.create' }),
        manager,
      );
    });

    it('throws when shortName is already used in the org', async () => {
      uomRepo.rows.push(uom());
      await expect(
        service.createUom(orgId, { name: 'Piece', shortName: 'PCS' }, actorId),
      ).rejects.toThrow(UomShortNameAlreadyUsedException);
    });
  });

  describe('listUoms', () => {
    it('wires search filter and pagination', async () => {
      const rows = [uom()];
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
      uomRepo.createQueryBuilder.mockReturnValue(qb);

      const [result, total] = await service.listUoms(orgId, {
        page: 1,
        limit: 20,
        search: 'pcs',
      });

      expect(result).toBe(rows);
      expect(total).toBe(1);
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('uom.shortName ILIKE :search'),
        { search: '%pcs%' },
      );
    });
  });

  describe('getUom', () => {
    it('returns the uom', async () => {
      uomRepo.rows.push(uom());
      const found = await service.getUom(orgId, 'uom-1');
      expect(found).toMatchObject({ id: 'uom-1', shortName: 'PCS' });
    });

    it('throws when missing', async () => {
      await expect(service.getUom(orgId, 'nope')).rejects.toThrow(
        UomNotFoundException,
      );
    });
  });

  describe('updateUom', () => {
    it('updates fields and audits', async () => {
      uomRepo.rows.push(uom());
      const updated = await service.updateUom(
        orgId,
        'uom-1',
        { name: 'Unit' },
        actorId,
      );
      expect(updated).toMatchObject({ name: 'Unit', shortName: 'PCS' });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'trading.uom.update' }),
        manager,
      );
    });

    it('throws when shortName collides', async () => {
      uomRepo.rows.push(uom({ id: 'uom-1', shortName: 'PCS' }));
      uomRepo.rows.push(uom({ id: 'uom-2', shortName: 'BOX' }));
      await expect(
        service.updateUom(orgId, 'uom-2', { shortName: 'PCS' }, actorId),
      ).rejects.toThrow(UomShortNameAlreadyUsedException);
    });

    it('throws when missing', async () => {
      await expect(
        service.updateUom(orgId, 'nope', { name: 'X' }, actorId),
      ).rejects.toThrow(UomNotFoundException);
    });
  });

  describe('deleteUom', () => {
    it('soft-deletes and audits', async () => {
      uomRepo.rows.push(uom());
      await service.deleteUom(orgId, 'uom-1', actorId);
      expect(uomRepo.rows).toHaveLength(0);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'trading.uom.delete' }),
      );
    });

    it('throws when missing', async () => {
      await expect(service.deleteUom(orgId, 'nope', actorId)).rejects.toThrow(
        UomNotFoundException,
      );
    });
  });
});
