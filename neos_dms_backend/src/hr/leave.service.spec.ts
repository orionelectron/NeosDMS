import { DataSource } from 'typeorm';
import { AuditLogEntity } from '../audit/audit-log.entity';
import { LeaveBalanceEntity } from './entities/leave-balance.entity';
import { LeaveTypeEntity } from './entities/leave-type.entity';
import {
  InsufficientLeaveBalanceException,
  InvalidLeaveRangeException,
  LeaveOverlapException,
  LeaveRequestNotFoundException,
  LeaveStatusTransitionException,
  LeaveTypeCodeAlreadyUsedException,
  LeaveTypeInactiveException,
  NotTheManagerException,
} from './hr.errors';
import { LeaveService } from './leave.service';
import {
  createHrTestingModule,
  endTestTransaction,
  beginTestTransaction,
  MANAGER_USER_ID,
  SALESMAN_USER_ID,
  seedHrBaseline,
  TEAMMATE_USER_ID,
  TEST_ORG_ID,
  type TestTransaction,
} from '../testing/hr-test.harness';
import { createTestDataSource } from '../testing/test-db';

describe('LeaveService', () => {
  const actorId = SALESMAN_USER_ID;
  const managerId = MANAGER_USER_ID;
  const from = { bsYear: 2082, bsMonth: 3, bsDay: 10 };
  const to = { bsYear: 2082, bsMonth: 3, bsDay: 12 };
  const days = 3;

  let dataSource: DataSource;
  let service: LeaveService;
  let tx: TestTransaction;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedHrBaseline(dataSource);
    const module = await createHrTestingModule(dataSource);
    service = module.get(LeaveService);
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

  const createType = async (
    overrides: Partial<{
      code: string;
      name: string;
      daysPerYear: number;
      requiresBalance: boolean;
      maxConsecutiveDays: number;
      isPaid: boolean;
    }> = {},
  ) => {
    const dto = {
      code: overrides.code ?? 'ANNUAL',
      name: overrides.name ?? 'Annual Leave',
      daysPerYear: overrides.daysPerYear ?? 12,
      requiresBalance: overrides.requiresBalance ?? true,
      maxConsecutiveDays: overrides.maxConsecutiveDays ?? 0,
      isPaid: overrides.isPaid ?? true,
    };
    return service.createLeaveType(TEST_ORG_ID, dto, managerId);
  };

  const grantBalance = async (
    userId: string,
    leaveTypeId: string,
    entitledDays: number,
    bsYear = 2082,
  ) =>
    service.upsertLeaveBalance(
      TEST_ORG_ID,
      { userId, leaveTypeId, bsYear, entitledDays },
      managerId,
    );

  const apply = async (
    leaveTypeId: string,
    f = from,
    t = to,
    reason = 'holiday',
  ) =>
    service.applyLeave(TEST_ORG_ID, actorId, {
      leaveTypeId,
      from: f,
      to: t,
      reason,
    });

  describe('leave types', () => {
    it('creates a leave type and audits it', async () => {
      const type = await createType({ code: 'SICK' });
      expect(type).toMatchObject({
        code: 'SICK',
        isActive: true,
        requiresBalance: true,
      });

      const audit = await dataSource
        .getRepository(AuditLogEntity)
        .findOneByOrFail({ action: 'hr.leave_type.create' });
      expect(audit.entityId).toBe(type.id);
    });

    it('rejects a duplicate code', async () => {
      await createType({ code: 'ANNUAL' });
      await expect(createType({ code: 'ANNUAL' })).rejects.toThrow(
        LeaveTypeCodeAlreadyUsedException,
      );
    });

    it('soft-deletes a leave type', async () => {
      const type = await createType({ code: 'MATERNITY' });
      await service.deleteLeaveType(TEST_ORG_ID, type.id, managerId);
      const gone = await dataSource
        .getRepository(LeaveTypeEntity)
        .findOneBy({ id: type.id });
      expect(gone?.deletedAt).not.toBeNull();
    });
  });

  describe('leave balances', () => {
    it('grants a balance and upserts on re-grant', async () => {
      const type = await createType();
      const first = await grantBalance(actorId, type.id, 12);
      expect(Number(first.entitledDays)).toBe(12);
      expect(Number(first.usedDays)).toBe(0);

      const second = await grantBalance(actorId, type.id, 15);
      expect(Number(second.entitledDays)).toBe(15);
      const rows = await dataSource.getRepository(LeaveBalanceEntity).findBy({
        organizationId: TEST_ORG_ID,
        userId: actorId,
        leaveTypeId: type.id,
      });
      expect(rows).toHaveLength(1);
    });

    it('reports available days across entitled/carryover/used', async () => {
      const type = await createType();
      await grantBalance(actorId, type.id, 10);
      const rows = await service.getLeaveBalances(TEST_ORG_ID, actorId, {});
      const row = rows.find((r) => r.leaveType.id === type.id);
      expect(row).toMatchObject({
        entitledDays: 10,
        carryoverDays: 0,
        usedDays: 0,
        availableDays: 10,
      });
    });

    it("blocks reading someone else's balance when not their manager", async () => {
      const type = await createType();
      await grantBalance(actorId, type.id, 5);
      await expect(
        service.getLeaveBalances(TEST_ORG_ID, TEAMMATE_USER_ID, {
          userId: actorId,
        }),
      ).rejects.toThrow(NotTheManagerException);
    });
  });

  describe('applyLeave', () => {
    it('creates a pending request, records a SUBMIT event and audits', async () => {
      const type = await createType();
      await grantBalance(actorId, type.id, days);
      const request = await apply(type.id);

      expect(request).toMatchObject({
        organizationId: TEST_ORG_ID,
        userId: actorId,
        status: 'PENDING',
        fromBsDate: '2082-03-10',
        toBsDate: '2082-03-12',
        days,
      });

      const events = await service.listApprovalEvents(
        TEST_ORG_ID,
        'leave_request',
        request.id,
      );
      expect(events.map((e) => e.action)).toEqual(['SUBMIT']);

      const audit = await dataSource
        .getRepository(AuditLogEntity)
        .findOneByOrFail({ action: 'hr.leave.create' });
      expect(audit.entityId).toBe(request.id);
    });

    it('rejects when the balance is insufficient', async () => {
      const type = await createType();
      await grantBalance(actorId, type.id, 1);
      await expect(apply(type.id)).rejects.toThrow(
        InsufficientLeaveBalanceException,
      );
    });

    it('rejects an overlapping range', async () => {
      const type = await createType();
      await grantBalance(actorId, type.id, 30);
      await apply(type.id);
      await expect(apply(type.id)).rejects.toThrow(LeaveOverlapException);
    });

    it('enforces the max consecutive days limit', async () => {
      const type = await createType({ maxConsecutiveDays: 2 });
      await grantBalance(actorId, type.id, 30);
      await expect(apply(type.id)).rejects.toThrow(InvalidLeaveRangeException);
    });

    it('rejects an inactive leave type', async () => {
      const type = await createType({ code: 'UNPAID' });
      await service.updateLeaveType(
        TEST_ORG_ID,
        type.id,
        { isActive: false },
        managerId,
      );
      await expect(apply(type.id)).rejects.toThrow(LeaveTypeInactiveException);
    });
  });

  describe('reviewLeave', () => {
    it('approves and consumes the balance once', async () => {
      const type = await createType();
      await grantBalance(actorId, type.id, 10);
      const request = await apply(type.id);

      const approved = await service.reviewLeave(
        TEST_ORG_ID,
        managerId,
        request.id,
        'APPROVE',
        'ok',
      );
      expect(approved.status).toBe('APPROVED');
      expect(approved.approvedBy).toBe(managerId);
      expect(approved.approvedAt).not.toBeNull();

      const balance = await dataSource
        .getRepository(LeaveBalanceEntity)
        .findOneByOrFail({
          organizationId: TEST_ORG_ID,
          userId: actorId,
          leaveTypeId: type.id,
        });
      expect(Number(balance.usedDays)).toBe(days);

      const events = await service.listApprovalEvents(
        TEST_ORG_ID,
        'leave_request',
        request.id,
      );
      expect(events.map((e) => e.action)).toEqual(['SUBMIT', 'APPROVE']);

      const audit = await dataSource
        .getRepository(AuditLogEntity)
        .findOneByOrFail({ action: 'hr.leave.approve' });
      expect(audit.entityId).toBe(request.id);
    });

    it('blocks a non-manager from approving', async () => {
      const type = await createType();
      await grantBalance(actorId, type.id, 10);
      const request = await apply(type.id);
      await expect(
        service.reviewLeave(
          TEST_ORG_ID,
          TEAMMATE_USER_ID,
          request.id,
          'APPROVE',
        ),
      ).rejects.toThrow(NotTheManagerException);
    });

    it('fails approval when the balance is already consumed', async () => {
      const type = await createType();
      await grantBalance(actorId, type.id, 3);
      const first = await apply(
        type.id,
        { bsYear: 2082, bsMonth: 3, bsDay: 10 },
        { bsYear: 2082, bsMonth: 3, bsDay: 11 },
      );
      const second = await apply(
        type.id,
        { bsYear: 2082, bsMonth: 4, bsDay: 1 },
        { bsYear: 2082, bsMonth: 4, bsDay: 2 },
      );
      await service.reviewLeave(TEST_ORG_ID, managerId, first.id, 'APPROVE');

      await expect(
        service.reviewLeave(TEST_ORG_ID, managerId, second.id, 'APPROVE'),
      ).rejects.toThrow(InsufficientLeaveBalanceException);
      expect(second.status).toBe('PENDING');
    });

    it('rejects without consuming balance', async () => {
      const type = await createType();
      await grantBalance(actorId, type.id, 10);
      const request = await apply(type.id);

      const rejected = await service.reviewLeave(
        TEST_ORG_ID,
        managerId,
        request.id,
        'REJECT',
        'not now',
      );
      expect(rejected.status).toBe('REJECTED');

      const balance = await dataSource
        .getRepository(LeaveBalanceEntity)
        .findOneByOrFail({
          organizationId: TEST_ORG_ID,
          userId: actorId,
          leaveTypeId: type.id,
        });
      expect(Number(balance.usedDays)).toBe(0);
    });

    it('refuses to re-review a non-pending request', async () => {
      const type = await createType();
      await grantBalance(actorId, type.id, 10);
      const request = await apply(type.id);
      await service.reviewLeave(TEST_ORG_ID, managerId, request.id, 'APPROVE');
      await expect(
        service.reviewLeave(TEST_ORG_ID, managerId, request.id, 'APPROVE'),
      ).rejects.toThrow(LeaveStatusTransitionException);
    });
  });

  describe('cancelLeave', () => {
    it('lets the requester cancel a pending request', async () => {
      const type = await createType();
      await grantBalance(actorId, type.id, 10);
      const request = await apply(type.id);
      const cancelled = await service.cancelLeave(
        TEST_ORG_ID,
        actorId,
        request.id,
      );
      expect(cancelled.status).toBe('CANCELLED');
    });

    it("lets the manager cancel a reportee's request", async () => {
      const type = await createType();
      await grantBalance(actorId, type.id, 10);
      const request = await apply(type.id);
      const cancelled = await service.cancelLeave(
        TEST_ORG_ID,
        managerId,
        request.id,
      );
      expect(cancelled.status).toBe('CANCELLED');
    });

    it('refuses to cancel an approved request', async () => {
      const type = await createType();
      await grantBalance(actorId, type.id, 10);
      const request = await apply(type.id);
      await service.reviewLeave(TEST_ORG_ID, managerId, request.id, 'APPROVE');
      await expect(
        service.cancelLeave(TEST_ORG_ID, actorId, request.id),
      ).rejects.toThrow(LeaveStatusTransitionException);
    });
  });

  describe('listLeaveRequests scoping', () => {
    it('shows own requests under mine, reportees under team, everyone under all', async () => {
      const type = await createType();
      await grantBalance(actorId, type.id, 30);
      await grantBalance(TEAMMATE_USER_ID, type.id, 30);
      const mine = await apply(type.id);
      const teammateReq = await service.applyLeave(
        TEST_ORG_ID,
        TEAMMATE_USER_ID,
        {
          leaveTypeId: type.id,
          from: { bsYear: 2082, bsMonth: 5, bsDay: 2 },
          to: { bsYear: 2082, bsMonth: 5, bsDay: 3 },
        },
      );

      const myList = await service.listLeaveRequests(
        TEST_ORG_ID,
        actorId,
        {},
        'mine',
      );
      expect(myList.map((r) => r.id)).toEqual([mine.id]);

      const managerTeam = await service.listLeaveRequests(
        TEST_ORG_ID,
        managerId,
        {},
        'team',
      );
      expect(managerTeam.map((r) => r.id)).toEqual(
        expect.arrayContaining([mine.id, teammateReq.id]),
      );

      const allList = await service.listLeaveRequests(
        TEST_ORG_ID,
        actorId,
        {},
        'all',
      );
      expect(allList.map((r) => r.id)).toEqual(
        expect.arrayContaining([mine.id, teammateReq.id]),
      );
    });
  });

  describe('reviewLeave edge cases', () => {
    it('throws not found for a missing request', async () => {
      await expect(
        service.reviewLeave(
          TEST_ORG_ID,
          managerId,
          '00000000-0000-4000-8000-000000000000',
          'APPROVE',
        ),
      ).rejects.toThrow(LeaveRequestNotFoundException);
    });
  });
});
