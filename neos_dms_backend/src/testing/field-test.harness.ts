import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { AuditLogEntity } from '../audit/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { OutletEntity } from '../field/entities/outlet.entity';
import { OutletRouteEntity } from '../field/entities/outlet-route.entity';
import { OutletVisitEntity } from '../field/entities/outlet-visit.entity';
import { RouteAssignmentEntity } from '../field/entities/route-assignment.entity';
import { RouteEntity } from '../field/entities/route.entity';
import { SalesTargetEntity } from '../field/entities/sales-target.entity';
import { SalesTargetService } from '../field/sales-target.service';
import { BrandEntity } from '../trading/entities/brand.entity';
import { ItemCategoryEntity } from '../trading/entities/item-category.entity';
import { OutletService } from '../field/outlet.service';
import { OutletImportService } from '../field/outlet-import.service';
import { OutletVisitService } from '../field/outlet-visit.service';
import { RouteAssignmentService } from '../field/route-assignment.service';
import { RouteImportService } from '../field/route-import.service';
import { RouteService } from '../field/route.service';
import { UserEntity } from '../iam/entities/user.entity';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { BranchEntity } from '../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../tenancy/entities/organization.entity';

export const TEST_ORG_ID = '11111111-1111-4111-8111-111111111111';
export const TEST_BRANCH_ID = '22222222-2222-4222-8222-222222222222';
export const SALESMAN_USER_ID = '33333333-3333-4333-8333-333333333333';
export const DRIVER_USER_ID = '44444444-4444-4444-8444-444444444444';

/**
 * Ensures the baseline org/branch/users the field FKs require exist. Uses
 * `upsert` so parallel jest workers and `--watch` reruns never collide on the
 * primary key or the users' unique email.
 */
export async function seedBaseline(dataSource: DataSource): Promise<void> {
  const manager = dataSource.manager;
  await manager.upsert(
    OrganizationEntity,
    {
      id: TEST_ORG_ID,
      name: 'Test Org',
      legalName: null,
      tradeName: null,
      email: 'test-org@test.local',
      phoneNumber: '555-0000',
      panNumber: 'TEST-PAN-0001',
      vatNumber: null,
      logoUrl: null,
      address: null,
    },
    ['id'],
  );

  await manager.upsert(
    BranchEntity,
    {
      id: TEST_BRANCH_ID,
      organizationId: TEST_ORG_ID,
      name: 'Test Branch',
      code: 'TEST-BR',
      location: null,
      isMainBranch: true,
      isActive: true,
      phone: null,
      email: null,
    },
    ['id'],
  );

  await manager.upsert(
    UserEntity,
    [
      {
        id: SALESMAN_USER_ID,
        organizationId: TEST_ORG_ID,
        branchId: TEST_BRANCH_ID,
        roleId: null,
        fullName: 'Sales Man',
        username: null,
        email: 'salesman@test.local',
        passwordHash: 'not-a-real-hash',
        isOwner: false,
        isActive: true,
        mustChangePassword: false,
        lastLoginAt: null,
      },
      {
        id: DRIVER_USER_ID,
        organizationId: TEST_ORG_ID,
        branchId: TEST_BRANCH_ID,
        roleId: null,
        fullName: 'Driver Guy',
        username: null,
        email: 'driver@test.local',
        passwordHash: 'not-a-real-hash',
        isOwner: false,
        isActive: true,
        mustChangePassword: false,
        lastLoginAt: null,
      },
    ],
    ['id'],
  );
}

export interface TestTransaction {
  runner: QueryRunner;
  manager: EntityManager;
}

/**
 * Starts a transaction on a fresh query runner and binds the DataSource's
 * default manager to it. Every repository obtained through the DataSource (and
 * every nested `dataSource.transaction()` call) then reuses this runner's
 * connection, nesting via savepoints (TypeORM tracks `transactionDepth`).
 * `endTestTransaction` rolls the whole thing back → per-test isolation without
 * a full DB reset (TestingHandBook §3.3).
 */
export async function beginTestTransaction(
  dataSource: DataSource,
): Promise<TestTransaction> {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  (dataSource.manager as unknown as { queryRunner: QueryRunner }).queryRunner =
    runner;
  return { runner, manager: dataSource.manager };
}

export async function endTestTransaction(
  dataSource: DataSource,
  tx: TestTransaction,
): Promise<void> {
  (
    dataSource.manager as unknown as { queryRunner: QueryRunner | undefined }
  ).queryRunner = undefined;
  await tx.runner.rollbackTransaction();
  await tx.runner.release();
}

/**
 * Compiles the real Field services against the real DataSource (real
 * repositories, real SQL, real constraints). AuditService runs for real too,
 * writing into `audit_logs` inside the same test transaction.
 */
export async function createFieldTestingModule(
  dataSource: DataSource,
): Promise<TestingModule> {
  const repo = (entity: unknown) => ({
    provide: getRepositoryToken(entity as new () => object),
    useFactory: (ds: DataSource) =>
      ds.getRepository(entity as new () => object),
    inject: [getDataSourceToken()],
  });

  return Test.createTestingModule({
    providers: [
      NepaliDateConverter,
      AuditService,
      repo(AuditLogEntity),
      { provide: getDataSourceToken(), useValue: dataSource },
      repo(OutletEntity),
      repo(RouteEntity),
      repo(OutletRouteEntity),
      repo(RouteAssignmentEntity),
      repo(OutletVisitEntity),
      repo(SalesTargetEntity),
      repo(ItemCategoryEntity),
      repo(BrandEntity),
      repo(UserEntity),
      OutletService,
      OutletImportService,
      RouteService,
      RouteImportService,
      RouteAssignmentService,
      OutletVisitService,
      SalesTargetService,
    ],
  }).compile();
}
