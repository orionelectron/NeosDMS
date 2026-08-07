import { DataSource } from 'typeorm';
import { AuditLogEntity } from '../audit/audit-log.entity';
import { OutletEntity } from './entities/outlet.entity';
import { OutletRouteEntity } from './entities/outlet-route.entity';
import { RouteAssignmentEntity } from './entities/route-assignment.entity';
import {
  RouteCodeAlreadyUsedException,
  RouteNotFoundException,
  RouteStatusTransitionException,
} from './field.errors';
import { RouteService } from './route.service';
import {
  createFieldTestingModule,
  endTestTransaction,
  beginTestTransaction,
  seedBaseline,
  SALESMAN_USER_ID,
  TEST_ORG_ID,
  type TestTransaction,
} from '../testing/field-test.harness';
import { createTestDataSource } from '../testing/test-db';

describe('RouteService', () => {
  const actorId = SALESMAN_USER_ID;

  let dataSource: DataSource;
  let service: RouteService;
  let tx: TestTransaction;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedBaseline(dataSource);
    const module = await createFieldTestingModule(dataSource);
    service = module.get(RouteService);
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

  const createOutlet = async (name: string) => {
    const repo = dataSource.getRepository(OutletEntity);
    return repo.save(
      repo.create({
        organizationId: TEST_ORG_ID,
        name,
        channel: 'GENERAL_TRADE',
        status: 'ACTIVE',
      }),
    );
  };

  describe('createRoute', () => {
    it('creates and audits', async () => {
      const created = await service.createRoute(
        TEST_ORG_ID,
        { name: 'Kathmandu North', code: 'R-NORTH' },
        actorId,
      );
      expect(created).toMatchObject({
        organizationId: TEST_ORG_ID,
        code: 'R-NORTH',
        status: 'ACTIVE',
      });

      const audit = await dataSource
        .getRepository(AuditLogEntity)
        .findOneByOrFail({ action: 'sales.route.create' });
      expect(audit.entityId).toBe(created.id);
    });

    it('throws on duplicate code', async () => {
      await service.createRoute(
        TEST_ORG_ID,
        { name: 'Kathmandu North', code: 'R-NORTH' },
        actorId,
      );
      await expect(
        service.createRoute(
          TEST_ORG_ID,
          { name: 'Other', code: 'R-NORTH' },
          actorId,
        ),
      ).rejects.toThrow(RouteCodeAlreadyUsedException);
    });
  });

  describe('getRoute', () => {
    it('returns the route', async () => {
      const created = await service.createRoute(
        TEST_ORG_ID,
        { name: 'Kathmandu North', code: 'R-NORTH' },
        actorId,
      );
      expect(await service.getRoute(TEST_ORG_ID, created.id)).toMatchObject({
        id: created.id,
      });
    });

    it('throws when missing', async () => {
      await expect(
        service.getRoute(TEST_ORG_ID, '00000000-0000-4000-8000-00000000dead'),
      ).rejects.toThrow(RouteNotFoundException);
    });
  });

  describe('updateRoute', () => {
    it('updates fields and audits', async () => {
      const created = await service.createRoute(
        TEST_ORG_ID,
        { name: 'Kathmandu North', code: 'R-NORTH' },
        actorId,
      );
      const updated = await service.updateRoute(
        TEST_ORG_ID,
        created.id,
        { name: 'R-North 2', status: 'INACTIVE' },
        actorId,
      );
      expect(updated).toMatchObject({ name: 'R-North 2', status: 'INACTIVE' });

      const audit = await dataSource
        .getRepository(AuditLogEntity)
        .findOneByOrFail({ action: 'sales.route.update' });
      expect(audit.entityId).toBe(created.id);
    });

    it('throws on duplicate code', async () => {
      const a = await service.createRoute(
        TEST_ORG_ID,
        { name: 'North', code: 'R-NORTH' },
        actorId,
      );
      const b = await service.createRoute(
        TEST_ORG_ID,
        { name: 'South', code: 'R-SOUTH' },
        actorId,
      );
      await expect(
        service.updateRoute(TEST_ORG_ID, b.id, { code: 'R-NORTH' }, actorId),
      ).rejects.toThrow(RouteCodeAlreadyUsedException);
      expect(a.code).toBe('R-NORTH');
    });

    it('forbids reactivating an inactive route', async () => {
      const created = await service.createRoute(
        TEST_ORG_ID,
        { name: 'North', code: 'R-NORTH' },
        actorId,
      );
      await service.updateRoute(
        TEST_ORG_ID,
        created.id,
        { status: 'INACTIVE' },
        actorId,
      );

      await expect(
        service.updateRoute(
          TEST_ORG_ID,
          created.id,
          { status: 'ACTIVE' },
          actorId,
        ),
      ).rejects.toThrow(RouteStatusTransitionException);
    });
  });

  describe('listRoutes', () => {
    it('searches by name/code and paginates', async () => {
      await service.createRoute(
        TEST_ORG_ID,
        { name: 'Kathmandu North', code: 'R-NORTH' },
        actorId,
      );
      await service.createRoute(
        TEST_ORG_ID,
        { name: 'Biratnagar South', code: 'R-SOUTH' },
        actorId,
      );

      const [result, total] = await service.listRoutes(TEST_ORG_ID, {
        page: 1,
        limit: 20,
        search: 'birat',
      });
      expect(total).toBe(1);
      expect(result[0].code).toBe('R-SOUTH');
    });
  });

  describe('listRouteOutlets', () => {
    it('returns outlets linked to the route', async () => {
      const route = await service.createRoute(
        TEST_ORG_ID,
        { name: 'North', code: 'R-NORTH' },
        actorId,
      );
      const outlet = await createOutlet('Alpha');

      const linkRepo = dataSource.getRepository(OutletRouteEntity);
      await linkRepo.save(
        linkRepo.create({
          organizationId: TEST_ORG_ID,
          outletId: outlet.id,
          routeId: route.id,
        }),
      );

      const outlets = await service.listRouteOutlets(TEST_ORG_ID, route.id);
      expect(outlets.map((o) => o.id)).toEqual([outlet.id]);
    });
  });

  describe('listMine', () => {
    it('returns only routes assigned to the salesman', async () => {
      const mine = await service.createRoute(
        TEST_ORG_ID,
        { name: 'My Route', code: 'R-MINE' },
        actorId,
      );
      const other = await service.createRoute(
        TEST_ORG_ID,
        { name: 'Not Mine', code: 'R-OTHER' },
        actorId,
      );

      const assignmentRepo = dataSource.getRepository(RouteAssignmentEntity);
      await assignmentRepo.save(
        assignmentRepo.create({
          organizationId: TEST_ORG_ID,
          userId: '33333333-3333-4333-8333-333333333333',
          routeId: mine.id,
          weekdays: [1, 3, 5],
        }),
      );

      const [rows] = await service.listMine(
        TEST_ORG_ID,
        '33333333-3333-4333-8333-333333333333',
        { page: 1, limit: 20 },
      );
      expect(rows.map((r) => r.id)).toEqual([mine.id]);
      expect(rows.map((r) => r.id)).not.toContain(other.id);
    });
  });
});
