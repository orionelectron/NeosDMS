import { DataSource } from 'typeorm';
import { AuditLogEntity } from '../audit/audit-log.entity';
import { UserNotFoundException } from '../iam/iam.errors';
import { RouteAssignmentEntity } from './entities/route-assignment.entity';
import { RouteEntity } from './entities/route.entity';
import {
  RouteAlreadyAssignedException,
  RouteAssignmentNotFoundException,
  RouteNotFoundException,
} from './field.errors';
import { RouteAssignmentService } from './route-assignment.service';
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

describe('RouteAssignmentService', () => {
  const actorId = SALESMAN_USER_ID;

  let dataSource: DataSource;
  let service: RouteAssignmentService;
  let tx: TestTransaction;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedBaseline(dataSource);
    const module = await createFieldTestingModule(dataSource);
    service = module.get(RouteAssignmentService);
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

  const createRoute = async (code: string) => {
    const repo = dataSource.getRepository(RouteEntity);
    return repo.save(
      repo.create({
        organizationId: TEST_ORG_ID,
        name: `Route ${code}`,
        code,
        status: 'ACTIVE',
      }),
    );
  };

  describe('createAssignment', () => {
    it('creates and audits', async () => {
      const route = await createRoute('R-1');

      const created = await service.createAssignment(
        TEST_ORG_ID,
        { userId: SALESMAN_USER_ID, routeId: route.id, weekdays: [1, 3, 5] },
        actorId,
      );
      expect(created).toMatchObject({
        organizationId: TEST_ORG_ID,
        userId: SALESMAN_USER_ID,
        routeId: route.id,
        weekdays: [1, 3, 5],
      });

      const audit = await dataSource
        .getRepository(AuditLogEntity)
        .findOneByOrFail({ action: 'sales.route_assignment.create' });
      expect(audit.entityId).toBe(created.id);
    });

    it('throws when the user does not exist in the org', async () => {
      const route = await createRoute('R-2');
      await expect(
        service.createAssignment(
          TEST_ORG_ID,
          { userId: '00000000-0000-4000-8000-00000000dead', routeId: route.id },
          actorId,
        ),
      ).rejects.toThrow(UserNotFoundException);
    });

    it('throws when the route does not exist in the org', async () => {
      await expect(
        service.createAssignment(
          TEST_ORG_ID,
          {
            userId: SALESMAN_USER_ID,
            routeId: '00000000-0000-4000-8000-00000000dead',
          },
          actorId,
        ),
      ).rejects.toThrow(RouteNotFoundException);
    });

    it('throws when the assignment already exists', async () => {
      const route = await createRoute('R-3');
      await service.createAssignment(
        TEST_ORG_ID,
        { userId: SALESMAN_USER_ID, routeId: route.id, weekdays: [1] },
        actorId,
      );

      await expect(
        service.createAssignment(
          TEST_ORG_ID,
          { userId: SALESMAN_USER_ID, routeId: route.id },
          actorId,
        ),
      ).rejects.toThrow(RouteAlreadyAssignedException);
    });
  });

  describe('listAssignments', () => {
    it('returns assignments for the org', async () => {
      const route = await createRoute('R-4');
      const created = await service.createAssignment(
        TEST_ORG_ID,
        { userId: SALESMAN_USER_ID, routeId: route.id, weekdays: [1] },
        actorId,
      );

      const [rows, total] = await service.listAssignments(TEST_ORG_ID, {
        page: 1,
        limit: 20,
        userId: SALESMAN_USER_ID,
      });
      expect(total).toBe(1);
      expect(rows[0].id).toBe(created.id);
    });
  });

  describe('updateAssignment', () => {
    it('updates weekdays', async () => {
      const route = await createRoute('R-5');
      const created = await service.createAssignment(
        TEST_ORG_ID,
        { userId: SALESMAN_USER_ID, routeId: route.id, weekdays: [1] },
        actorId,
      );

      const updated = await service.updateAssignment(
        TEST_ORG_ID,
        created.id,
        { weekdays: [2, 4] },
        actorId,
      );
      expect(updated.weekdays).toEqual([2, 4]);

      const audit = await dataSource
        .getRepository(AuditLogEntity)
        .findOneByOrFail({ action: 'sales.route_assignment.update' });
      expect(audit.entityId).toBe(created.id);
    });

    it('throws when missing', async () => {
      await expect(
        service.updateAssignment(
          TEST_ORG_ID,
          '00000000-0000-4000-8000-00000000dead',
          { weekdays: [] },
          actorId,
        ),
      ).rejects.toThrow(RouteAssignmentNotFoundException);
    });
  });

  describe('deleteAssignment', () => {
    it('deletes and audits', async () => {
      const route = await createRoute('R-6');
      const created = await service.createAssignment(
        TEST_ORG_ID,
        { userId: SALESMAN_USER_ID, routeId: route.id },
        actorId,
      );

      await service.deleteAssignment(TEST_ORG_ID, created.id, actorId);

      const remaining = await dataSource
        .getRepository(RouteAssignmentEntity)
        .countBy({ organizationId: TEST_ORG_ID });
      expect(remaining).toBe(0);
      const audit = await dataSource
        .getRepository(AuditLogEntity)
        .findOneByOrFail({ action: 'sales.route_assignment.delete' });
      expect(audit.entityId).toBe(created.id);
    });

    it('throws when missing', async () => {
      await expect(
        service.deleteAssignment(
          TEST_ORG_ID,
          '00000000-0000-4000-8000-00000000dead',
          actorId,
        ),
      ).rejects.toThrow(RouteAssignmentNotFoundException);
    });
  });
});
