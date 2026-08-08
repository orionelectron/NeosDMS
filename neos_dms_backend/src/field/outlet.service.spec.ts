import { DataSource } from 'typeorm';
import { PartyEntity } from '../accounting/entities/party.entity';
import { AuditLogEntity } from '../audit/audit-log.entity';
import { OutletRouteEntity } from './entities/outlet-route.entity';
import { RouteAssignmentEntity } from './entities/route-assignment.entity';
import { RouteEntity } from './entities/route.entity';
import {
  OutletNameAlreadyUsedException,
  OutletNotFoundException,
  OutletNotOnRouteException,
  OutletRouteAlreadyLinkedException,
} from './field.errors';
import { OutletService } from './outlet.service';
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

describe('OutletService', () => {
  const actorId = SALESMAN_USER_ID;

  let dataSource: DataSource;
  let service: OutletService;
  let tx: TestTransaction;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedBaseline(dataSource);
    const module = await createFieldTestingModule(dataSource);
    service = module.get(OutletService);
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

  describe('createOutlet', () => {
    it('provisions a customer party and audits in one transaction', async () => {
      const created = await service.createOutlet(
        TEST_ORG_ID,
        { name: 'Surya General', email: 'surya@example.com' },
        actorId,
      );

      expect(created.organizationId).toBe(TEST_ORG_ID);
      expect(created.partyId).toBeDefined();

      const party = await dataSource
        .getRepository(PartyEntity)
        .findOneByOrFail({ id: created.partyId! });
      expect(party).toMatchObject({
        organizationId: TEST_ORG_ID,
        isCustomer: true,
        name: 'Surya General',
      });

      const audit = await dataSource
        .getRepository(AuditLogEntity)
        .findOneByOrFail({ action: 'sales.outlet.create' });
      expect(audit.entityId).toBe(created.id);
    });

    it('throws when the outlet name is already used', async () => {
      await service.createOutlet(
        TEST_ORG_ID,
        { name: 'Surya General' },
        actorId,
      );

      await expect(
        service.createOutlet(TEST_ORG_ID, { name: 'Surya General' }, actorId),
      ).rejects.toThrow(OutletNameAlreadyUsedException);
    });

    it('reuses an explicitly linked party', async () => {
      const party = await dataSource.getRepository(PartyEntity).save(
        dataSource.getRepository(PartyEntity).create({
          organizationId: TEST_ORG_ID,
          branchId: null,
          currencyId: null,
          paymentTermId: null,
          name: 'Existing Party',
          legalName: null,
          partyKind: 'BUSINESS',
          isCustomer: true,
          isSupplier: false,
          isLead: false,
          panNumber: null,
          vatNumber: null,
          email: null,
          phone: null,
          address: null,
          creditLimit: '0',
          openingBalance: '0',
          isActive: true,
        }),
      );

      const beforeCount = await dataSource.getRepository(PartyEntity).count();

      const created = await service.createOutlet(
        TEST_ORG_ID,
        { name: 'New Outlet', partyId: party.id },
        actorId,
      );

      expect(created.partyId).toBe(party.id);
      const count = await dataSource.getRepository(PartyEntity).count();
      expect(count).toBe(beforeCount);
    });
  });

  describe('getOutlet', () => {
    it('returns the outlet', async () => {
      const created = await service.createOutlet(
        TEST_ORG_ID,
        { name: 'Surya General' },
        actorId,
      );
      const found = await service.getOutlet(TEST_ORG_ID, created.id);
      expect(found).toMatchObject({ id: created.id, name: 'Surya General' });
    });

    it('throws when missing', async () => {
      await expect(
        service.getOutlet(TEST_ORG_ID, '00000000-0000-4000-8000-00000000dead'),
      ).rejects.toThrow(OutletNotFoundException);
    });
  });

  describe('listOutlets', () => {
    it('searches by name and returns paginated results', async () => {
      await service.createOutlet(
        TEST_ORG_ID,
        { name: 'Surya General' },
        actorId,
      );
      await service.createOutlet(
        TEST_ORG_ID,
        { name: 'Annapurna Stores' },
        actorId,
      );

      const [rows, total] = await service.listOutlets(TEST_ORG_ID, {
        page: 1,
        limit: 20,
        search: 'annapurna',
      });

      expect(total).toBe(1);
      expect(rows[0].name).toBe('Annapurna Stores');
    });

    it('filters by routeId', async () => {
      const outlet = await service.createOutlet(
        TEST_ORG_ID,
        { name: 'On Route Outlet' },
        actorId,
      );
      const route = await createRoute('R-FILTER');
      await service.linkRoute(TEST_ORG_ID, outlet.id, route.id, actorId);

      const [rows] = await service.listOutlets(TEST_ORG_ID, {
        page: 1,
        limit: 20,
        routeId: route.id,
      });
      expect(rows.map((r) => r.id)).toEqual([outlet.id]);
    });
  });

  describe('listMine', () => {
    it('returns only outlets on routes the salesman is assigned to', async () => {
      const mine = await service.createOutlet(
        TEST_ORG_ID,
        { name: 'My Outlet' },
        actorId,
      );
      const other = await service.createOutlet(
        TEST_ORG_ID,
        { name: 'Not Mine' },
        actorId,
      );
      const myRoute = await createRoute('R-MINE');
      const otherRoute = await createRoute('R-OTHER');
      await service.linkRoute(TEST_ORG_ID, mine.id, myRoute.id, actorId);
      await service.linkRoute(TEST_ORG_ID, other.id, otherRoute.id, actorId);

      await dataSource.getRepository(RouteAssignmentEntity).save(
        dataSource.getRepository(RouteAssignmentEntity).create({
          organizationId: TEST_ORG_ID,
          userId: '33333333-3333-4333-8333-333333333333',
          routeId: myRoute.id,
          weekdays: [1],
        }),
      );

      const [rows] = await service.listMine(
        TEST_ORG_ID,
        '33333333-3333-4333-8333-333333333333',
        { page: 1, limit: 20 },
      );
      expect(rows.map((r) => r.id)).toEqual([mine.id]);
    });
  });

  describe('updateOutlet', () => {
    it('updates fields and audits', async () => {
      const created = await service.createOutlet(
        TEST_ORG_ID,
        { name: 'Surya General' },
        actorId,
      );
      const updated = await service.updateOutlet(
        TEST_ORG_ID,
        created.id,
        { category: 'Grocery', status: 'INACTIVE' },
        actorId,
      );

      expect(updated).toMatchObject({
        category: 'Grocery',
        status: 'INACTIVE',
      });
      const persisted = await service.getOutlet(TEST_ORG_ID, created.id);
      expect(persisted).toMatchObject({
        category: 'Grocery',
        status: 'INACTIVE',
      });

      const audit = await dataSource
        .getRepository(AuditLogEntity)
        .findOneByOrFail({ action: 'sales.outlet.update' });
      expect(audit.entityId).toBe(created.id);
    });

    it('throws when renaming to a used name', async () => {
      const a = await service.createOutlet(
        TEST_ORG_ID,
        { name: 'Alpha' },
        actorId,
      );
      const b = await service.createOutlet(
        TEST_ORG_ID,
        { name: 'Bravo' },
        actorId,
      );

      await expect(
        service.updateOutlet(TEST_ORG_ID, b.id, { name: 'Alpha' }, actorId),
      ).rejects.toThrow(OutletNameAlreadyUsedException);
      expect(a.name).toBe('Alpha');
    });

    it('throws when the outlet is missing', async () => {
      await expect(
        service.updateOutlet(
          TEST_ORG_ID,
          '00000000-0000-4000-8000-00000000dead',
          { category: 'x' },
          actorId,
        ),
      ).rejects.toThrow(OutletNotFoundException);
    });
  });

  describe('deleteOutlet', () => {
    it('soft-deletes and audits', async () => {
      const created = await service.createOutlet(
        TEST_ORG_ID,
        { name: 'Surya General' },
        actorId,
      );

      await service.deleteOutlet(TEST_ORG_ID, created.id, actorId);

      await expect(service.getOutlet(TEST_ORG_ID, created.id)).rejects.toThrow(
        OutletNotFoundException,
      );
      const audit = await dataSource
        .getRepository(AuditLogEntity)
        .findOneByOrFail({ action: 'sales.outlet.delete' });
      expect(audit.entityId).toBe(created.id);
    });

    it('throws when missing', async () => {
      await expect(
        service.deleteOutlet(
          TEST_ORG_ID,
          '00000000-0000-4000-8000-00000000dead',
          actorId,
        ),
      ).rejects.toThrow(OutletNotFoundException);
    });
  });

  describe('linkRoute / unlinkRoute', () => {
    it('links then unlinks a route, persisting the junction row', async () => {
      const outlet = await service.createOutlet(
        TEST_ORG_ID,
        { name: 'Surya General' },
        actorId,
      );
      const route = await createRoute('R-LINK');

      await service.linkRoute(TEST_ORG_ID, outlet.id, route.id, actorId);
      let link = await dataSource.getRepository(OutletRouteEntity).findOneBy({
        organizationId: TEST_ORG_ID,
        outletId: outlet.id,
        routeId: route.id,
      });
      expect(link).toBeDefined();

      await service.unlinkRoute(TEST_ORG_ID, outlet.id, route.id, actorId);
      link = await dataSource.getRepository(OutletRouteEntity).findOneBy({
        organizationId: TEST_ORG_ID,
        outletId: outlet.id,
        routeId: route.id,
      });
      expect(link).toBeNull();
    });

    it('throws when linking twice', async () => {
      const outlet = await service.createOutlet(
        TEST_ORG_ID,
        { name: 'Surya General' },
        actorId,
      );
      const route = await createRoute('R-DUP');
      await service.linkRoute(TEST_ORG_ID, outlet.id, route.id, actorId);

      await expect(
        service.linkRoute(TEST_ORG_ID, outlet.id, route.id, actorId),
      ).rejects.toThrow(OutletRouteAlreadyLinkedException);
    });

    it('throws OutletNotOnRouteException on unlink of a missing link', async () => {
      const outlet = await service.createOutlet(
        TEST_ORG_ID,
        { name: 'Surya General' },
        actorId,
      );
      const route = await createRoute('R-UNLINK');

      await expect(
        service.unlinkRoute(TEST_ORG_ID, outlet.id, route.id, actorId),
      ).rejects.toThrow(OutletNotOnRouteException);
    });
  });
});
