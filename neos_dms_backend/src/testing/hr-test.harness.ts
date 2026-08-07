import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditLogEntity } from '../audit/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { ApprovalEventEntity } from '../hr/entities/approval-event.entity';
import { AttendanceEntity } from '../hr/entities/attendance.entity';
import { LeaveBalanceEntity } from '../hr/entities/leave-balance.entity';
import { LeaveRequestEntity } from '../hr/entities/leave-request.entity';
import { LeaveTypeEntity } from '../hr/entities/leave-type.entity';
import { TravelExpenseClaimEntity } from '../hr/entities/travel-expense-claim.entity';
import { TravelExpenseItemEntity } from '../hr/entities/travel-expense-item.entity';
import { TravelRequestEntity } from '../hr/entities/travel-request.entity';
import { AttendanceService } from '../hr/attendance.service';
import { LeaveService } from '../hr/leave.service';
import { TravelService } from '../hr/travel.service';
import { UserEntity } from '../iam/entities/user.entity';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import {
  beginTestTransaction,
  endTestTransaction,
  SALESMAN_USER_ID,
  seedBaseline,
  TEST_BRANCH_ID,
  TEST_ORG_ID,
  type TestTransaction,
} from './field-test.harness';

export {
  beginTestTransaction,
  endTestTransaction,
  SALESMAN_USER_ID,
  TEST_ORG_ID,
};
export type { TestTransaction };
export const MANAGER_USER_ID = '55555555-5555-4555-8555-555555555555';
export const TEAMMATE_USER_ID = '66666666-6666-4666-8666-666666666666';
export const ACCOUNTANT_USER_ID = '77777777-7777-4777-8777-777777777777';

/**
 * Baseline + the HR users: MANAGER_USER_ID is manager of both SALESMAN and
 * TEAMMATE. `update` (not upsert) sets `manager_id` so reruns stay idempotent.
 */
export async function seedHrBaseline(dataSource: DataSource): Promise<void> {
  await seedBaseline(dataSource);
  const manager = dataSource.manager;
  await manager.upsert(
    UserEntity,
    [
      {
        id: MANAGER_USER_ID,
        organizationId: TEST_ORG_ID,
        branchId: TEST_BRANCH_ID,
        roleId: null,
        fullName: 'Manager Guy',
        username: null,
        email: 'manager@test.local',
        passwordHash: 'not-a-real-hash',
        isOwner: false,
        isActive: true,
        mustChangePassword: false,
        lastLoginAt: null,
      },
      {
        id: TEAMMATE_USER_ID,
        organizationId: TEST_ORG_ID,
        branchId: TEST_BRANCH_ID,
        roleId: null,
        fullName: 'Teammate Guy',
        username: null,
        email: 'teammate@test.local',
        passwordHash: 'not-a-real-hash',
        isOwner: false,
        isActive: true,
        mustChangePassword: false,
        lastLoginAt: null,
        managerId: MANAGER_USER_ID,
      },
      {
        id: ACCOUNTANT_USER_ID,
        organizationId: TEST_ORG_ID,
        branchId: TEST_BRANCH_ID,
        roleId: null,
        fullName: 'Accountant Guy',
        username: null,
        email: 'accountant@test.local',
        passwordHash: 'not-a-real-hash',
        isOwner: false,
        isActive: true,
        mustChangePassword: false,
        lastLoginAt: null,
      },
    ],
    ['id'],
  );
  await manager.update(
    UserEntity,
    { id: SALESMAN_USER_ID },
    { managerId: MANAGER_USER_ID },
  );
}

/**
 * Compiles the real HR service against the real DataSource (real repositories,
 * real SQL, real constraints) with AuditService writing inside the same
 * transaction.
 */
export async function createHrTestingModule(
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
      repo(UserEntity),
      repo(LeaveTypeEntity),
      repo(LeaveBalanceEntity),
      repo(LeaveRequestEntity),
      repo(TravelRequestEntity),
      repo(TravelExpenseClaimEntity),
      repo(TravelExpenseItemEntity),
      repo(ApprovalEventEntity),
      repo(AttendanceEntity),
      LeaveService,
      TravelService,
      AttendanceService,
    ],
  }).compile();
}
