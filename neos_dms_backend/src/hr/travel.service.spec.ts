import { DataSource } from 'typeorm';
import { AuditLogEntity } from '../audit/audit-log.entity';
import { TravelExpenseClaimEntity } from './entities/travel-expense-claim.entity';
import { TravelExpenseItemEntity } from './entities/travel-expense-item.entity';
import {
  ExpenseClaimNotFoundException,
  ExpenseClaimStatusTransitionException,
  ExpenseItemNotFoundException,
  InvalidBsRangeException,
  NotTheManagerException,
  TravelRequestMismatchException,
  TravelStatusTransitionException,
} from './hr.errors';
import { TravelService } from './travel.service';
import {
  ACCOUNTANT_USER_ID,
  beginTestTransaction,
  createHrTestingModule,
  endTestTransaction,
  MANAGER_USER_ID,
  SALESMAN_USER_ID,
  seedHrBaseline,
  TEAMMATE_USER_ID,
  TEST_ORG_ID,
  type TestTransaction,
} from '../testing/hr-test.harness';
import { createTestDataSource } from '../testing/test-db';

describe('TravelService', () => {
  const actorId = SALESMAN_USER_ID;
  const managerId = MANAGER_USER_ID;
  const from = { bsYear: 2082, bsMonth: 3, bsDay: 10 };
  const to = { bsYear: 2082, bsMonth: 3, bsDay: 12 };

  let dataSource: DataSource;
  let service: TravelService;
  let tx: TestTransaction;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedHrBaseline(dataSource);
    const module = await createHrTestingModule(dataSource);
    service = module.get(TravelService);
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

  const createTravel = async (
    overrides: {
      purpose?: string;
      from?: { bsYear: number; bsMonth: number; bsDay: number };
      to?: { bsYear: number; bsMonth: number; bsDay: number };
    } = {},
  ) =>
    service.createTravelRequest(TEST_ORG_ID, actorId, {
      purpose: overrides.purpose ?? 'client visit',
      from: overrides.from ?? from,
      to: overrides.to ?? to,
      transportMode: 'BUS',
      estimatedCost: 5000,
    });

  const createClaim = async (travelRequestId?: string) =>
    service.createExpenseClaim(TEST_ORG_ID, actorId, {
      travelRequestId,
      from,
      to,
    });

  const addItem = async (
    claimId: string,
    amount: number,
    category: string = 'FOOD',
    bsDate = { bsYear: 2082, bsMonth: 3, bsDay: 10 },
  ) =>
    service.addExpenseItem(TEST_ORG_ID, actorId, claimId, {
      bsDate,
      category: category as 'FOOD',
      description: 'lunch',
      amount,
    });

  describe('travel requests', () => {
    it('creates a pending request, records SUBMIT and audits', async () => {
      const request = await createTravel();
      expect(request).toMatchObject({
        organizationId: TEST_ORG_ID,
        userId: actorId,
        status: 'PENDING',
        transportMode: 'BUS',
        fromBsDate: '2082-03-10',
        toBsDate: '2082-03-12',
      });

      const events = await service.listApprovalEvents(
        TEST_ORG_ID,
        'travel_request',
        request.id,
      );
      expect(events.map((e) => e.action)).toEqual(['SUBMIT']);

      const audit = await dataSource
        .getRepository(AuditLogEntity)
        .findOneByOrFail({ action: 'hr.travel_request.create' });
      expect(audit.entityId).toBe(request.id);
    });

    it('rejects an inverted BS range', async () => {
      await expect(
        createTravel({
          from: { bsYear: 2082, bsMonth: 3, bsDay: 12 },
          to: { bsYear: 2082, bsMonth: 3, bsDay: 10 },
        }),
      ).rejects.toThrow(InvalidBsRangeException);
    });

    it('lets the requester edit a pending request', async () => {
      const request = await createTravel();
      const updated = await service.updateTravelRequest(
        TEST_ORG_ID,
        actorId,
        request.id,
        {
          purpose: 'expedited visit',
          transportMode: 'AIR',
          estimatedCost: 9000,
        },
      );
      expect(updated.purpose).toBe('expedited visit');
      expect(updated.transportMode).toBe('AIR');
      expect(Number(updated.estimatedCost)).toBe(9000);

      const events = await service.listApprovalEvents(
        TEST_ORG_ID,
        'travel_request',
        request.id,
      );
      expect(events.map((e) => e.action)).toEqual(['SUBMIT', 'UPDATE']);
    });

    it("blocks editing someone else's request", async () => {
      const request = await createTravel();
      await expect(
        service.updateTravelRequest(TEST_ORG_ID, TEAMMATE_USER_ID, request.id, {
          purpose: 'hijack',
        }),
      ).rejects.toThrow(TravelStatusTransitionException);
    });

    it('blocks editing a non-pending request', async () => {
      const request = await createTravel();
      await service.reviewTravelRequest(
        TEST_ORG_ID,
        managerId,
        request.id,
        'APPROVE',
      );
      await expect(
        service.updateTravelRequest(TEST_ORG_ID, actorId, request.id, {
          purpose: 'late edit',
        }),
      ).rejects.toThrow(TravelStatusTransitionException);
    });

    it('approves via the manager and rejects otherwise', async () => {
      const request = await createTravel();
      const approved = await service.reviewTravelRequest(
        TEST_ORG_ID,
        managerId,
        request.id,
        'APPROVE',
        'ok',
      );
      expect(approved.status).toBe('APPROVED');
      expect(approved.approvedBy).toBe(managerId);

      const another = await createTravel({ purpose: 'second trip' });
      await expect(
        service.reviewTravelRequest(
          TEST_ORG_ID,
          TEAMMATE_USER_ID,
          another.id,
          'APPROVE',
        ),
      ).rejects.toThrow(NotTheManagerException);
    });

    it('rejects a pending request', async () => {
      const request = await createTravel();
      const rejected = await service.reviewTravelRequest(
        TEST_ORG_ID,
        managerId,
        request.id,
        'REJECT',
        'not budgeted',
      );
      expect(rejected.status).toBe('REJECTED');
      expect(rejected.reviewerNote).toBe('not budgeted');
    });

    it('cancels only while pending', async () => {
      const request = await createTravel();
      const cancelled = await service.cancelTravelRequest(
        TEST_ORG_ID,
        actorId,
        request.id,
      );
      expect(cancelled.status).toBe('CANCELLED');

      const second = await createTravel({ purpose: 'second trip' });
      await service.reviewTravelRequest(
        TEST_ORG_ID,
        managerId,
        second.id,
        'APPROVE',
      );
      await expect(
        service.cancelTravelRequest(TEST_ORG_ID, actorId, second.id),
      ).rejects.toThrow(TravelStatusTransitionException);
    });

    it('scopes lists to mine/team/all', async () => {
      const mine = await createTravel();
      const teammate = await service.createTravelRequest(
        TEST_ORG_ID,
        TEAMMATE_USER_ID,
        {
          purpose: 'teammate trip',
          from,
          to,
          transportMode: 'BUS',
        },
      );

      const myList = await service.listTravelRequests(
        TEST_ORG_ID,
        actorId,
        {},
        'mine',
      );
      expect(myList.map((r) => r.id)).toEqual([mine.id]);

      const managerTeam = await service.listTravelRequests(
        TEST_ORG_ID,
        managerId,
        {},
        'team',
      );
      expect(managerTeam.map((r) => r.id)).toEqual(
        expect.arrayContaining([mine.id, teammate.id]),
      );

      const allList = await service.listTravelRequests(
        TEST_ORG_ID,
        actorId,
        {},
        'all',
      );
      expect(allList.map((r) => r.id)).toEqual(
        expect.arrayContaining([mine.id, teammate.id]),
      );
    });
  });

  describe('expense claims', () => {
    it('creates a zero-total pending claim and audits', async () => {
      const claim = await createClaim();
      expect(claim).toMatchObject({
        organizationId: TEST_ORG_ID,
        userId: actorId,
        status: 'PENDING',
        fromBsDate: '2082-03-10',
        toBsDate: '2082-03-12',
      });
      expect(Number(claim.total)).toBe(0);

      const audit = await dataSource
        .getRepository(AuditLogEntity)
        .findOneByOrFail({ action: 'hr.expense.create' });
      expect(audit.entityId).toBe(claim.id);
    });

    it("rejects a claim linked to someone else's travel request", async () => {
      const travel = await service.createTravelRequest(
        TEST_ORG_ID,
        TEAMMATE_USER_ID,
        {
          purpose: 'teammate trip',
          from,
          to,
          transportMode: 'BUS',
        },
      );
      await expect(createClaim(travel.id)).rejects.toThrow(
        TravelRequestMismatchException,
      );
    });

    it('links a claim to the claimant own travel request', async () => {
      const travel = await createTravel();
      const claim = await createClaim(travel.id);
      expect(claim.travelRequestId).toBe(travel.id);
    });

    it('recomputes the total as items are added, updated and removed', async () => {
      const claim = await createClaim();
      const first = await addItem(claim.id, 1000);
      await addItem(claim.id, 2500, 'HOTEL');
      expect(
        Number(
          (await service.listExpenseClaims(TEST_ORG_ID, actorId, {}, 'mine'))[0]
            .total,
        ),
      ).toBe(3500);

      await service.updateExpenseItem(
        TEST_ORG_ID,
        actorId,
        claim.id,
        first.id,
        {
          amount: 1500,
        },
      );
      expect(
        Number(
          (
            await dataSource
              .getRepository(TravelExpenseClaimEntity)
              .findOneByOrFail({ id: claim.id })
          ).total,
        ),
      ).toBe(4000);

      await service.removeExpenseItem(TEST_ORG_ID, actorId, claim.id, first.id);
      expect(
        Number(
          (
            await dataSource
              .getRepository(TravelExpenseClaimEntity)
              .findOneByOrFail({ id: claim.id })
          ).total,
        ),
      ).toBe(2500);
    });

    it('defaults approved_amount to amount and resets it on edit', async () => {
      const claim = await createClaim();
      const item = await addItem(claim.id, 1200);
      expect(Number(item.approvedAmount)).toBe(1200);

      await service.updateExpenseItem(TEST_ORG_ID, actorId, claim.id, item.id, {
        amount: 800,
      });
      const reloaded = await dataSource
        .getRepository(TravelExpenseItemEntity)
        .findOneByOrFail({ id: item.id });
      expect(Number(reloaded.approvedAmount)).toBe(800);
    });

    it("blocks editing another user's claim", async () => {
      const claim = await createClaim();
      await expect(
        service.addExpenseItem(TEST_ORG_ID, TEAMMATE_USER_ID, claim.id, {
          bsDate: from,
          category: 'FOOD',
          description: 'intrusion',
          amount: 500,
        }),
      ).rejects.toThrow(ExpenseClaimStatusTransitionException);
    });

    it('approves only via the claimant manager, records the event', async () => {
      const claim = await createClaim();
      await expect(
        service.reviewExpenseClaim(
          TEST_ORG_ID,
          TEAMMATE_USER_ID,
          claim.id,
          'APPROVE',
        ),
      ).rejects.toThrow(NotTheManagerException);

      const approved = await service.reviewExpenseClaim(
        TEST_ORG_ID,
        managerId,
        claim.id,
        'APPROVE',
        'fine',
      );
      expect(approved.status).toBe('APPROVED');
      expect(approved.approvedBy).toBe(managerId);

      const events = await service.listApprovalEvents(
        TEST_ORG_ID,
        'expense_claim',
        claim.id,
      );
      expect(events.map((e) => e.action)).toEqual(['SUBMIT', 'APPROVE']);
    });

    it('rejects a claim without paying', async () => {
      const claim = await createClaim();
      const rejected = await service.reviewExpenseClaim(
        TEST_ORG_ID,
        managerId,
        claim.id,
        'REJECT',
        'no receipt',
      );
      expect(rejected.status).toBe('REJECTED');
    });

    it('refuses to pay a pending claim', async () => {
      const claim = await createClaim();
      await expect(
        service.payExpenseClaim(TEST_ORG_ID, ACCOUNTANT_USER_ID, claim.id, {}),
      ).rejects.toThrow(ExpenseClaimStatusTransitionException);
    });

    it('pays an approved claim and records the PAID event', async () => {
      const claim = await createClaim();
      await service.reviewExpenseClaim(
        TEST_ORG_ID,
        managerId,
        claim.id,
        'APPROVE',
      );
      const paid = await service.payExpenseClaim(
        TEST_ORG_ID,
        ACCOUNTANT_USER_ID,
        claim.id,
        { note: 'reimbursed' },
      );
      expect(paid.status).toBe('PAID');
      expect(paid.paidBy).toBe(ACCOUNTANT_USER_ID);
      expect(paid.paidAt).not.toBeNull();

      const events = await service.listApprovalEvents(
        TEST_ORG_ID,
        'expense_claim',
        claim.id,
      );
      expect(events.map((e) => e.action)).toEqual([
        'SUBMIT',
        'APPROVE',
        'PAID',
      ]);

      const audit = await dataSource
        .getRepository(AuditLogEntity)
        .findOneByOrFail({ action: 'hr.expense.pay' });
      expect(audit.entityId).toBe(claim.id);
    });

    it('applies per-item approved amounts at pay time', async () => {
      const claim = await createClaim();
      const hotel = await addItem(claim.id, 3000, 'HOTEL');
      const food = await addItem(claim.id, 1000);
      await service.reviewExpenseClaim(
        TEST_ORG_ID,
        managerId,
        claim.id,
        'APPROVE',
      );

      const paid = await service.payExpenseClaim(
        TEST_ORG_ID,
        ACCOUNTANT_USER_ID,
        claim.id,
        {
          items: [
            { id: hotel.id, approvedAmount: 2500 },
            { id: food.id, approvedAmount: 1000 },
          ],
        },
      );
      expect(Number(paid.total)).toBe(3500);

      const items = await dataSource
        .getRepository(TravelExpenseItemEntity)
        .findBy({ organizationId: TEST_ORG_ID, claimId: claim.id });
      expect(items.map((i) => Number(i.approvedAmount)).sort()).toEqual([
        1000, 2500,
      ]);
    });

    it('rejects adjustments that reference items outside the claim', async () => {
      const claim = await createClaim();
      const other = await service.createExpenseClaim(
        TEST_ORG_ID,
        TEAMMATE_USER_ID,
        { from, to },
      );
      const foreignItem = await service.addExpenseItem(
        TEST_ORG_ID,
        TEAMMATE_USER_ID,
        other.id,
        { bsDate: from, category: 'FOOD', description: 'x', amount: 500 },
      );
      await service.reviewExpenseClaim(
        TEST_ORG_ID,
        managerId,
        claim.id,
        'APPROVE',
      );
      await expect(
        service.payExpenseClaim(TEST_ORG_ID, ACCOUNTANT_USER_ID, claim.id, {
          items: [{ id: foreignItem.id, approvedAmount: 100 }],
        }),
      ).rejects.toThrow(ExpenseItemNotFoundException);
    });

    it('cancels only while pending', async () => {
      const claim = await createClaim();
      const cancelled = await service.cancelExpenseClaim(
        TEST_ORG_ID,
        actorId,
        claim.id,
      );
      expect(cancelled.status).toBe('CANCELLED');

      const second = await createClaim();
      await service.reviewExpenseClaim(
        TEST_ORG_ID,
        managerId,
        second.id,
        'APPROVE',
      );
      await expect(
        service.cancelExpenseClaim(TEST_ORG_ID, actorId, second.id),
      ).rejects.toThrow(ExpenseClaimStatusTransitionException);
    });

    it('scopes lists to mine/team/all', async () => {
      const mine = await createClaim();
      const teammate = await service.createExpenseClaim(
        TEST_ORG_ID,
        TEAMMATE_USER_ID,
        { from, to },
      );

      const myList = await service.listExpenseClaims(
        TEST_ORG_ID,
        actorId,
        {},
        'mine',
      );
      expect(myList.map((c) => c.id)).toEqual([mine.id]);

      const managerTeam = await service.listExpenseClaims(
        TEST_ORG_ID,
        managerId,
        {},
        'team',
      );
      expect(managerTeam.map((c) => c.id)).toEqual(
        expect.arrayContaining([mine.id, teammate.id]),
      );

      const allList = await service.listExpenseClaims(
        TEST_ORG_ID,
        ACCOUNTANT_USER_ID,
        {},
        'all',
      );
      expect(allList.map((c) => c.id)).toEqual(
        expect.arrayContaining([mine.id, teammate.id]),
      );
    });

    it('throws not found for missing claims', async () => {
      await expect(
        service.reviewExpenseClaim(
          TEST_ORG_ID,
          managerId,
          '00000000-0000-4000-8000-000000000000',
          'APPROVE',
        ),
      ).rejects.toThrow(ExpenseClaimNotFoundException);
    });
  });
});
