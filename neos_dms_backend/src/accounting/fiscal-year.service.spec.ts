import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../audit/audit.service';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import {
  FiscalYearAlreadyExistsException,
  FiscalYearClosedException,
  FiscalYearNotFoundException,
  FiscalYearOverlapException,
  NoActiveFiscalYearException,
} from './accounting.errors';
import { FiscalPeriodEntity } from './entities/fiscal-period.entity';
import { FiscalYearEntity } from './entities/fiscal-year.entity';
import { FiscalYearService } from './fiscal-year.service';
import {
  createFakeManager,
  makeEntity,
  type FakeManager,
  type FakeRepo,
} from '../testing/accounting-fakes';

describe('FiscalYearService', () => {
  const orgId = 'org-1';
  const actorId = 'user-1';

  let service: FiscalYearService;
  let manager: FakeManager;
  let fyRepo: FakeRepo<FiscalYearEntity>;
  let periodRepo: FakeRepo<FiscalPeriodEntity>;
  let audit: { record: jest.Mock };

  const fiscalYear = (data: Partial<FiscalYearEntity>) =>
    makeEntity(FiscalYearEntity, {
      organizationId: orgId,
      isClosed: false,
      ...data,
    });

  beforeEach(async () => {
    const { manager: m, repo } = createFakeManager();
    manager = m;
    fyRepo = repo(FiscalYearEntity);
    periodRepo = repo(FiscalPeriodEntity);
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const dataSource = {
      transaction: jest.fn((fn: (m: unknown) => unknown) => fn(manager)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FiscalYearService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getRepositoryToken(FiscalYearEntity), useValue: fyRepo },
        {
          provide: getRepositoryToken(FiscalPeriodEntity),
          useValue: periodRepo,
        },
        { provide: NepaliDateConverter, useValue: new NepaliDateConverter() },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(FiscalYearService);
  });

  describe('listFiscalYears', () => {
    it('lists years for the organization ordered by start date descending', async () => {
      fyRepo.rows.push(
        fiscalYear({
          id: 'fy-1',
          name: '2082/83',
          startDate: new Date(2025, 3, 14),
          endDate: new Date(2026, 3, 13),
          isActive: true,
        }),
      );
      fyRepo.rows.push(
        fiscalYear({
          id: 'fy-2',
          name: '2083/84',
          startDate: new Date(2026, 3, 14),
          endDate: new Date(2027, 3, 13),
          isActive: true,
        }),
      );

      const result = await service.listFiscalYears(orgId);

      expect(result.map((fy) => fy.id)).toEqual(['fy-2', 'fy-1']);
    });
  });

  describe('getFiscalYear', () => {
    it('throws FiscalYearNotFoundException when missing', async () => {
      await expect(service.getFiscalYear(orgId, 'nope')).rejects.toThrow(
        FiscalYearNotFoundException,
      );
    });
  });

  describe('getActiveFiscalYear', () => {
    it('returns the active fiscal year', async () => {
      fyRepo.rows.push(
        fiscalYear({
          id: 'fy-1',
          name: '2083/84',
          startDate: new Date(2026, 3, 14),
          endDate: new Date(2027, 3, 13),
          isActive: true,
        }),
      );

      await expect(service.getActiveFiscalYear(orgId)).resolves.toMatchObject({
        id: 'fy-1',
        isActive: true,
      });
    });

    it('throws NoActiveFiscalYearException when none is active', async () => {
      await expect(service.getActiveFiscalYear(orgId)).rejects.toThrow(
        NoActiveFiscalYearException,
      );
    });
  });

  describe('createFiscalYear', () => {
    it('creates the first year as active with 12 periods and audits', async () => {
      const fy = await service.createFiscalYear(
        orgId,
        { bsYear: 2083 },
        actorId,
      );

      expect(fy).toMatchObject({
        organizationId: orgId,
        name: '2083/84',
        isActive: true,
        isClosed: false,
      });
      expect(fy.startDate.getFullYear()).toBe(2026);

      const periods = periodRepo.rows;
      expect(periods).toHaveLength(12);
      expect(periods[0]).toMatchObject({
        fiscalYearId: fy.id,
        sequence: 1,
        name: 'Shrawan',
        isLocked: false,
      });
      expect(periods[0].startDateBs).toMatch(/^2083-04-01$/);
      expect(periods.map((period) => period.sequence)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
      ]);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'accounting.fiscal-year.create' }),
        manager,
      );
    });

    it('creates subsequent years as inactive', async () => {
      fyRepo.rows.push(
        fiscalYear({
          id: 'fy-prev',
          name: '2082/83',
          startDate: new Date(2025, 3, 14),
          endDate: new Date(2026, 3, 13),
          isActive: true,
        }),
      );

      const fy = await service.createFiscalYear(
        orgId,
        { bsYear: 2083 },
        actorId,
      );

      expect(fy.isActive).toBe(false);
    });

    it('rejects a duplicate name', async () => {
      fyRepo.rows.push(
        fiscalYear({
          id: 'fy-1',
          name: '2083/84',
          startDate: new Date(2026, 3, 14),
          endDate: new Date(2027, 3, 13),
          isActive: true,
        }),
      );

      await expect(
        service.createFiscalYear(orgId, { bsYear: 2083 }, actorId),
      ).rejects.toThrow(FiscalYearAlreadyExistsException);
    });

    it('rejects a fiscal year overlapping an existing one', async () => {
      fyRepo.rows.push(
        fiscalYear({
          id: 'fy-1',
          name: '2082/83',
          startDate: new Date(2025, 3, 14),
          endDate: new Date(2027, 3, 13),
          isActive: false,
        }),
      );
      const overlapQb: {
        where: jest.Mock;
        andWhere: jest.Mock;
        getOne: jest.Mock;
      } = {
        where: jest.fn(() => overlapQb),
        andWhere: jest.fn(() => overlapQb),
        getOne: jest.fn(() => fyRepo.rows[0]),
      };
      fyRepo.createQueryBuilder.mockReturnValue(overlapQb);

      await expect(
        service.createFiscalYear(orgId, { bsYear: 2083 }, actorId),
      ).rejects.toThrow(FiscalYearOverlapException);
    });
  });

  describe('openFiscalYear', () => {
    it('activates the target and deactivates the rest', async () => {
      fyRepo.rows.push(
        fiscalYear({
          id: 'fy-1',
          name: '2082/83',
          startDate: new Date(2025, 3, 14),
          endDate: new Date(2026, 3, 13),
          isActive: true,
        }),
      );
      fyRepo.rows.push(
        fiscalYear({
          id: 'fy-2',
          name: '2083/84',
          startDate: new Date(2026, 3, 14),
          endDate: new Date(2027, 3, 13),
          isActive: false,
        }),
      );

      const opened = await service.openFiscalYear(orgId, 'fy-2', actorId);

      expect(opened).toMatchObject({ id: 'fy-2', isActive: true });
      expect(fyRepo.rows.find((fy) => fy.id === 'fy-1')?.isActive).toBe(false);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'accounting.fiscal-year.update' }),
        manager,
      );
    });

    it('rejects opening a closed fiscal year', async () => {
      fyRepo.rows.push(
        fiscalYear({
          id: 'fy-1',
          name: '2082/83',
          startDate: new Date(2025, 3, 14),
          endDate: new Date(2026, 3, 13),
          isActive: false,
          isClosed: true,
        }),
      );

      await expect(
        service.openFiscalYear(orgId, 'fy-1', actorId),
      ).rejects.toThrow(FiscalYearClosedException);
    });

    it('throws FiscalYearNotFoundException when missing', async () => {
      await expect(
        service.openFiscalYear(orgId, 'nope', actorId),
      ).rejects.toThrow(FiscalYearNotFoundException);
    });
  });

  describe('closeFiscalYear', () => {
    it('closes the year and locks all open periods', async () => {
      fyRepo.rows.push(
        fiscalYear({
          id: 'fy-1',
          name: '2083/84',
          startDate: new Date(2026, 3, 14),
          endDate: new Date(2027, 3, 13),
          isActive: true,
          isClosed: false,
        }),
      );
      for (let i = 1; i <= 12; i++) {
        periodRepo.rows.push(
          makeEntity(FiscalPeriodEntity, {
            id: `fp-${i}`,
            fiscalYearId: 'fy-1',
            name: `Period ${i}`,
            sequence: i,
            isLocked: false,
          }),
        );
      }

      const closed = await service.closeFiscalYear(orgId, 'fy-1', actorId);

      expect(closed).toMatchObject({
        isClosed: true,
        isActive: false,
        closedBy: actorId,
      });
      expect(closed.closedAt).toBeInstanceOf(Date);
      expect(periodRepo.rows.every((period) => period.isLocked)).toBe(true);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'accounting.fiscal-year.close' }),
        manager,
      );
    });

    it('rejects closing an already-closed year', async () => {
      fyRepo.rows.push(
        fiscalYear({
          id: 'fy-1',
          name: '2083/84',
          startDate: new Date(2026, 3, 14),
          endDate: new Date(2027, 3, 13),
          isActive: false,
          isClosed: true,
        }),
      );

      await expect(
        service.closeFiscalYear(orgId, 'fy-1', actorId),
      ).rejects.toThrow(FiscalYearClosedException);
    });
  });

  describe('listPeriods', () => {
    it('lists periods for a year in sequence order', async () => {
      fyRepo.rows.push(
        fiscalYear({
          id: 'fy-1',
          name: '2083/84',
          startDate: new Date(2026, 3, 14),
          endDate: new Date(2027, 3, 13),
          isActive: true,
        }),
      );
      for (const sequence of [2, 1, 3]) {
        periodRepo.rows.push(
          makeEntity(FiscalPeriodEntity, {
            id: `fp-${sequence}`,
            fiscalYearId: 'fy-1',
            name: `Period ${sequence}`,
            sequence,
            isLocked: false,
          }),
        );
      }

      const periods = await service.listPeriods(orgId, 'fy-1');

      expect(periods.map((period) => period.sequence)).toEqual([1, 2, 3]);
    });

    it('throws FiscalYearNotFoundException when the year is missing', async () => {
      await expect(service.listPeriods(orgId, 'nope')).rejects.toThrow(
        FiscalYearNotFoundException,
      );
    });
  });
});
