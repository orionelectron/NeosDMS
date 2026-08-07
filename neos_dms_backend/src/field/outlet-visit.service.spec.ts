import { DataSource } from 'typeorm';
import { AuditLogEntity } from '../audit/audit-log.entity';
import { OutletEntity } from './entities/outlet.entity';
import { OutletRouteEntity } from './entities/outlet-route.entity';
import { RouteAssignmentEntity } from './entities/route-assignment.entity';
import { RouteEntity } from './entities/route.entity';
import {
  InvalidVisitStatusTransitionException,
  OutletNotOnRouteException,
  OutletVisitNotFoundException,
  RouteNotFoundException,
  SalesmanNotAssignedToRouteException,
} from './field.errors';
import { OutletVisitService } from './outlet-visit.service';
import {
  createFieldTestingModule,
  endTestTransaction,
  beginTestTransaction,
  seedBaseline,
  DRIVER_USER_ID,
  SALESMAN_USER_ID,
  TEST_ORG_ID,
  type TestTransaction,
} from '../testing/field-test.harness';
import { createTestDataSource } from '../testing/test-db';

describe('OutletVisitService', () => {
  const OUTLET_LAT = '27.7172';
  const OUTLET_LON = '85.3136';

  let dataSource: DataSource;
  let service: OutletVisitService;
  let tx: TestTransaction;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedBaseline(dataSource);
    const module = await createFieldTestingModule(dataSource);
    service = module.get(OutletVisitService);
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

  /** Route + outlet + junction link + salesman assignment, all in the org. */
  const setupRouteForSalesman = async (code: string) => {
    const routeRepo = dataSource.getRepository(RouteEntity);
    const route = await routeRepo.save(
      routeRepo.create({
        organizationId: TEST_ORG_ID,
        name: `Route ${code}`,
        code,
        status: 'ACTIVE',
      }),
    );

    const outletRepo = dataSource.getRepository(OutletEntity);
    const outlet = await outletRepo.save(
      outletRepo.create({
        organizationId: TEST_ORG_ID,
        name: `Outlet ${code}`,
        latitude: OUTLET_LAT,
        longitude: OUTLET_LON,
        channel: 'GENERAL_TRADE',
        status: 'ACTIVE',
      }),
    );

    const linkRepo = dataSource.getRepository(OutletRouteEntity);
    await linkRepo.save(
      linkRepo.create({
        organizationId: TEST_ORG_ID,
        outletId: outlet.id,
        routeId: route.id,
      }),
    );

    const assignmentRepo = dataSource.getRepository(RouteAssignmentEntity);
    await assignmentRepo.save(
      assignmentRepo.create({
        organizationId: TEST_ORG_ID,
        userId: SALESMAN_USER_ID,
        routeId: route.id,
        weekdays: [1, 3, 5],
      }),
    );

    return { route, outlet };
  };

  describe('createVisit', () => {
    it('schedules a visit for an assigned salesman on a routed outlet', async () => {
      const { route, outlet } = await setupRouteForSalesman('V1');

      const created = await service.createVisit(
        TEST_ORG_ID,
        { routeId: route.id, outletId: outlet.id },
        SALESMAN_USER_ID,
      );
      expect(created).toMatchObject({
        organizationId: TEST_ORG_ID,
        userId: SALESMAN_USER_ID,
        routeId: route.id,
        outletId: outlet.id,
        visitType: 'PLANNED',
        status: 'SCHEDULED',
      });

      const audit = await dataSource
        .getRepository(AuditLogEntity)
        .findOneByOrFail({ action: 'sales.visit.create' });
      expect(audit.entityId).toBe(created.id);
    });

    it('throws when the route does not exist', async () => {
      await expect(
        service.createVisit(
          TEST_ORG_ID,
          {
            routeId: '00000000-0000-4000-8000-00000000dead',
            outletId: '00000000-0000-4000-8000-00000000dead',
          },
          SALESMAN_USER_ID,
        ),
      ).rejects.toThrow(RouteNotFoundException);
    });

    it('throws when the salesman is not assigned to the route', async () => {
      const { route, outlet } = await setupRouteForSalesman('V2');
      await expect(
        service.createVisit(
          TEST_ORG_ID,
          { routeId: route.id, outletId: outlet.id },
          DRIVER_USER_ID,
        ),
      ).rejects.toThrow(SalesmanNotAssignedToRouteException);
    });

    it('throws when the outlet is not on the route', async () => {
      const { route } = await setupRouteForSalesman('V3');
      const otherRoute = await setupRouteForSalesman('V4');
      await expect(
        service.createVisit(
          TEST_ORG_ID,
          { routeId: route.id, outletId: otherRoute.outlet.id },
          SALESMAN_USER_ID,
        ),
      ).rejects.toThrow(OutletNotOnRouteException);
    });
  });

  describe('checkIn', () => {
    it('checks in at the outlet and flags off-route=false', async () => {
      const { route, outlet } = await setupRouteForSalesman('V5');
      const visit = await service.createVisit(
        TEST_ORG_ID,
        { routeId: route.id, outletId: outlet.id },
        SALESMAN_USER_ID,
      );

      const updated = await service.checkIn(
        TEST_ORG_ID,
        visit.id,
        SALESMAN_USER_ID,
        {
          latitude: 27.7172,
          longitude: 85.3136,
        },
      );
      expect(updated.status).toBe('CHECKED_IN');
      expect(updated.checkedInAt).toBeDefined();
      expect(updated.distanceFromOutletMeters).toBe('0.00');
      expect(updated.isOffRoute).toBe(false);

      const audit = await dataSource
        .getRepository(AuditLogEntity)
        .findOneByOrFail({ action: 'sales.visit.check_in' });
      expect(audit.newData).toMatchObject({ isOffRoute: false });
    });

    it('flags off-route=true when beyond the 200m tolerance', async () => {
      const { route, outlet } = await setupRouteForSalesman('V6');
      const visit = await service.createVisit(
        TEST_ORG_ID,
        { routeId: route.id, outletId: outlet.id },
        SALESMAN_USER_ID,
      );

      // ~0.002 degrees latitude ≈ 222 m from the outlet.
      const updated = await service.checkIn(
        TEST_ORG_ID,
        visit.id,
        SALESMAN_USER_ID,
        {
          latitude: 27.7192,
          longitude: 85.3136,
        },
      );
      const dist = parseFloat(updated.distanceFromOutletMeters!);
      expect(dist).toBeGreaterThan(200);
      expect(updated.isOffRoute).toBe(true);
    });

    it('throws when the visit is not in SCHEDULED state', async () => {
      const { route, outlet } = await setupRouteForSalesman('V7');
      const visit = await service.createVisit(
        TEST_ORG_ID,
        { routeId: route.id, outletId: outlet.id },
        SALESMAN_USER_ID,
      );
      await service.checkIn(TEST_ORG_ID, visit.id, SALESMAN_USER_ID, {
        latitude: 27.7172,
        longitude: 85.3136,
      });

      await expect(
        service.checkIn(TEST_ORG_ID, visit.id, SALESMAN_USER_ID, {
          latitude: 27.7172,
          longitude: 85.3136,
        }),
      ).rejects.toThrow(InvalidVisitStatusTransitionException);
    });
  });

  describe('checkOut', () => {
    it('checks out from CHECKED_IN', async () => {
      const { route, outlet } = await setupRouteForSalesman('V8');
      const visit = await service.createVisit(
        TEST_ORG_ID,
        { routeId: route.id, outletId: outlet.id },
        SALESMAN_USER_ID,
      );
      await service.checkIn(TEST_ORG_ID, visit.id, SALESMAN_USER_ID, {
        latitude: 27.7172,
        longitude: 85.3136,
      });

      const updated = await service.checkOut(
        TEST_ORG_ID,
        visit.id,
        SALESMAN_USER_ID,
        {
          latitude: 27.7172,
          longitude: 85.3136,
        },
      );
      expect(updated.status).toBe('CHECKED_OUT');
      expect(updated.checkedOutAt).toBeDefined();
    });

    it('throws when not checked in', async () => {
      const { route, outlet } = await setupRouteForSalesman('V9');
      const visit = await service.createVisit(
        TEST_ORG_ID,
        { routeId: route.id, outletId: outlet.id },
        SALESMAN_USER_ID,
      );

      await expect(
        service.checkOut(TEST_ORG_ID, visit.id, SALESMAN_USER_ID, {
          latitude: 27.7172,
          longitude: 85.3136,
        }),
      ).rejects.toThrow(InvalidVisitStatusTransitionException);
    });
  });

  describe('cancel', () => {
    it('cancels a SCHEDULED visit', async () => {
      const { route, outlet } = await setupRouteForSalesman('V10');
      const visit = await service.createVisit(
        TEST_ORG_ID,
        { routeId: route.id, outletId: outlet.id },
        SALESMAN_USER_ID,
      );

      const updated = await service.cancel(
        TEST_ORG_ID,
        visit.id,
        SALESMAN_USER_ID,
      );
      expect(updated.status).toBe('CANCELLED');
    });

    it('throws when cancelling a CHECKED_IN visit', async () => {
      const { route, outlet } = await setupRouteForSalesman('V11');
      const visit = await service.createVisit(
        TEST_ORG_ID,
        { routeId: route.id, outletId: outlet.id },
        SALESMAN_USER_ID,
      );
      await service.checkIn(TEST_ORG_ID, visit.id, SALESMAN_USER_ID, {
        latitude: 27.7172,
        longitude: 85.3136,
      });

      await expect(
        service.cancel(TEST_ORG_ID, visit.id, SALESMAN_USER_ID),
      ).rejects.toThrow(InvalidVisitStatusTransitionException);
    });
  });

  describe('listVisits', () => {
    it('returns visits for the org filtered by status', async () => {
      const { route, outlet } = await setupRouteForSalesman('V12');
      const visit = await service.createVisit(
        TEST_ORG_ID,
        { routeId: route.id, outletId: outlet.id },
        SALESMAN_USER_ID,
      );

      const [rows, total] = await service.listVisits(TEST_ORG_ID, {
        page: 1,
        limit: 20,
        status: 'SCHEDULED',
      });
      expect(total).toBe(1);
      expect(rows[0].id).toBe(visit.id);
    });
  });

  describe('getVisit', () => {
    it('returns the visit with relations', async () => {
      const { route, outlet } = await setupRouteForSalesman('V13');
      const visit = await service.createVisit(
        TEST_ORG_ID,
        { routeId: route.id, outletId: outlet.id },
        SALESMAN_USER_ID,
      );

      const found = await service.getVisit(TEST_ORG_ID, visit.id);
      expect(found.id).toBe(visit.id);
      expect(found.outlet.id).toBe(outlet.id);
      expect(found.route.id).toBe(route.id);
      expect(found.user.id).toBe(SALESMAN_USER_ID);
    });

    it('throws when missing', async () => {
      await expect(
        service.getVisit(TEST_ORG_ID, '00000000-0000-4000-8000-00000000dead'),
      ).rejects.toThrow(OutletVisitNotFoundException);
    });
  });
});
