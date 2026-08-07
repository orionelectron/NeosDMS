import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../audit/audit.service';
import {
  createFakeManager,
  makeEntity,
  type FakeManager,
  type FakeRepo,
} from '../testing/accounting-fakes';
import { ItemEntity } from './entities/item.entity';
import { UomConversionEntity } from './entities/uom-conversion.entity';
import { UomEntity } from './entities/uom.entity';
import {
  InvalidConversionFactorException,
  ItemNotFoundException,
  SameUomConversionException,
  UomConversionNotFoundException,
  UomNotFoundException,
} from './trading.errors';
import { UomConversionService } from './uom-conversion.service';

describe('UomConversionService', () => {
  const orgId = 'org-1';
  const actorId = 'user-1';

  let service: UomConversionService;
  let manager: FakeManager;
  let getRepo: ReturnType<typeof createFakeManager>['repo'];
  let conversionRepo: FakeRepo<UomConversionEntity>;
  let audit: { record: jest.Mock };

  const conversion = (overrides: Partial<UomConversionEntity> = {}) =>
    makeEntity(UomConversionEntity, {
      id: 'conv-1',
      organizationId: orgId,
      itemId: null,
      fromUomId: 'uom-1',
      toUomId: 'uom-2',
      conversionFactor: '2',
      ...overrides,
    });

  beforeEach(async () => {
    const { manager: m, repo } = createFakeManager();
    manager = m;
    getRepo = repo;
    conversionRepo = repo(UomConversionEntity);
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const dataSource = {
      transaction: jest.fn((fn: (m: unknown) => unknown) => fn(manager)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UomConversionService,
        { provide: getDataSourceToken(), useValue: dataSource },
        {
          provide: getRepositoryToken(UomConversionEntity),
          useValue: conversionRepo,
        },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(UomConversionService);
  });

  describe('createUomConversion', () => {
    it('creates an org-wide conversion and audits in the transaction', async () => {
      getRepo(UomEntity).rows.push(
        makeEntity(UomEntity, { id: 'uom-1', organizationId: orgId }),
        makeEntity(UomEntity, { id: 'uom-2', organizationId: orgId }),
      );

      const created = await service.createUomConversion(
        orgId,
        { fromUomId: 'uom-1', toUomId: 'uom-2', conversionFactor: 2 },
        actorId,
      );

      expect(created).toMatchObject({
        organizationId: orgId,
        itemId: null,
        fromUomId: 'uom-1',
        toUomId: 'uom-2',
        conversionFactor: '2.000000',
      });
      expect(created.id).toBeDefined();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'trading.uom-conversion.create' }),
        manager,
      );
    });

    it('creates a per-item override when itemId is given', async () => {
      getRepo(UomEntity).rows.push(
        makeEntity(UomEntity, { id: 'uom-1', organizationId: orgId }),
        makeEntity(UomEntity, { id: 'uom-2', organizationId: orgId }),
      );
      getRepo(ItemEntity).rows.push(
        makeEntity(ItemEntity, { id: 'item-1', organizationId: orgId }),
      );

      const created = await service.createUomConversion(
        orgId,
        {
          itemId: 'item-1',
          fromUomId: 'uom-1',
          toUomId: 'uom-2',
          conversionFactor: 1.5,
        },
        actorId,
      );

      expect(created.itemId).toBe('item-1');
      expect(created.conversionFactor).toBe('1.500000');
    });

    it('rejects a non-positive factor', async () => {
      await expect(
        service.createUomConversion(
          orgId,
          { fromUomId: 'uom-1', toUomId: 'uom-2', conversionFactor: 0 },
          actorId,
        ),
      ).rejects.toThrow(InvalidConversionFactorException);
    });

    it('rejects same-uom conversions', async () => {
      await expect(
        service.createUomConversion(
          orgId,
          { fromUomId: 'uom-1', toUomId: 'uom-1', conversionFactor: 1 },
          actorId,
        ),
      ).rejects.toThrow(SameUomConversionException);
    });

    it('rejects uoms outside the org', async () => {
      await expect(
        service.createUomConversion(
          orgId,
          { fromUomId: 'missing', toUomId: 'uom-2', conversionFactor: 2 },
          actorId,
        ),
      ).rejects.toThrow(UomNotFoundException);
    });

    it('rejects items outside the org', async () => {
      getRepo(UomEntity).rows.push(
        makeEntity(UomEntity, { id: 'uom-1', organizationId: orgId }),
        makeEntity(UomEntity, { id: 'uom-2', organizationId: orgId }),
      );
      await expect(
        service.createUomConversion(
          orgId,
          {
            itemId: 'missing-item',
            fromUomId: 'uom-1',
            toUomId: 'uom-2',
            conversionFactor: 2,
          },
          actorId,
        ),
      ).rejects.toThrow(ItemNotFoundException);
    });
  });

  describe('listUomConversions', () => {
    it('wires org scope and optional item filter', async () => {
      const rows = [conversion()];
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
      conversionRepo.createQueryBuilder.mockReturnValue(qb);

      const [result, total] = await service.listUomConversions(orgId, {
        page: 1,
        limit: 20,
        itemId: 'item-1',
      });

      expect(result).toBe(rows);
      expect(total).toBe(1);
      expect(qb.where).toHaveBeenCalledWith(
        'conversion.organizationId = :organizationId',
        { organizationId: orgId },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('conversion.itemId = :itemId', {
        itemId: 'item-1',
      });
    });
  });

  describe('getUomConversion', () => {
    it('returns the conversion with relations', async () => {
      conversionRepo.rows.push(conversion());
      const found = await service.getUomConversion(orgId, 'conv-1');
      expect(found).toMatchObject({ id: 'conv-1', conversionFactor: '2' });
      expect(conversionRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv-1', organizationId: orgId },
          relations: { fromUom: true, toUom: true, item: true },
        }),
      );
    });

    it('throws when missing', async () => {
      await expect(service.getUomConversion(orgId, 'nope')).rejects.toThrow(
        UomConversionNotFoundException,
      );
    });
  });

  describe('deleteUomConversion', () => {
    it('soft-deletes and audits', async () => {
      conversionRepo.rows.push(conversion());
      await service.deleteUomConversion(orgId, 'conv-1', actorId);
      expect(conversionRepo.rows).toHaveLength(0);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'trading.uom-conversion.delete' }),
      );
    });

    it('throws when missing', async () => {
      await expect(
        service.deleteUomConversion(orgId, 'nope', actorId),
      ).rejects.toThrow(UomConversionNotFoundException);
    });
  });
});
