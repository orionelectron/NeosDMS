import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { SubscriptionEntity } from '../entities/subscription.entity';
import { OrganizationUsageEntity } from '../entities/organization-usage.entity';
import {
  PlanFeatureUnavailableException,
  PlanLimitExceededException,
  NoActiveSubscriptionException,
} from '../subscription.errors';
import { PlanLimitService } from './plan-limit.service';
import type { PlanLimits } from '../subscription.constants';

function makeSubscription(
  limits: PlanLimits,
  currentPeriodStart = new Date('2026-08-01T00:00:00Z'),
): SubscriptionEntity {
  return {
    status: 'trialing',
    currentPeriodStart,
    plan: { code: 'starter', name: 'Starter', limits },
  } as unknown as SubscriptionEntity;
}

function makeUsage(
  organizationId: string,
  resourceCode: string,
  currentUsage: number,
  lastResetAt: Date | null,
): OrganizationUsageEntity {
  return {
    organizationId,
    resourceCode,
    currentUsage,
    lastResetAt,
  } as OrganizationUsageEntity;
}

describe('PlanLimitService', () => {
  let service: PlanLimitService;
  let subscriptionRepo: { findOne: jest.Mock };
  let usageRepo: { findOne: jest.Mock; find: jest.Mock };
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    subscriptionRepo = { findOne: jest.fn() };
    usageRepo = { findOne: jest.fn(), find: jest.fn() };
    dataSource = { query: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PlanLimitService,
        {
          provide: getRepositoryToken(SubscriptionEntity),
          useValue: subscriptionRepo,
        },
        {
          provide: getRepositoryToken(OrganizationUsageEntity),
          useValue: usageRepo,
        },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(PlanLimitService);
  });

  describe('requireActiveSubscription', () => {
    it('throws NoActiveSubscriptionException when none exists', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);
      await expect(service.requireActiveSubscription('org-1')).rejects.toThrow(
        NoActiveSubscriptionException,
      );
    });
  });

  describe('assertSeat', () => {
    it('allows when current is under the limit', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSubscription({ users: 5 }),
      );
      await expect(
        service.assertSeat('org-1', 'users', 4),
      ).resolves.toBeUndefined();
    });

    it('throws with resource/limit/current when current equals the limit', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSubscription({ users: 5 }),
      );
      const promise = service.assertSeat('org-1', 'users', 5);
      await expect(promise).rejects.toBeInstanceOf(PlanLimitExceededException);
      await promise.catch((error: PlanLimitExceededException) => {
        expect(error.getResponse()).toMatchObject({
          code: 'PLAN_LIMIT_EXCEEDED',
          details: { resource: 'users', limit: 5, current: 5 },
        });
      });
    });

    it('never trips for unlimited (-1)', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSubscription({ users: -1 }),
      );
      await expect(
        service.assertSeat('org-1', 'users', 999),
      ).resolves.toBeUndefined();
    });

    it('treats a missing limit as no cap', async () => {
      subscriptionRepo.findOne.mockResolvedValue(makeSubscription({}));
      await expect(
        service.assertSeat('org-1', 'unknown', 999),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertFeature', () => {
    it('throws PlanFeatureUnavailableException when disabled', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSubscription({ multi_branch: false }),
      );
      await expect(
        service.assertFeature('org-1', 'multi_branch'),
      ).rejects.toThrow(PlanFeatureUnavailableException);
    });

    it('allows when enabled', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSubscription({ multi_branch: true }),
      );
      await expect(
        service.assertFeature('org-1', 'multi_branch'),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertPeriodicAvailable', () => {
    it('allows when usage is below the limit', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSubscription({ invoices_per_month: 100 }),
      );
      usageRepo.findOne.mockResolvedValue(
        makeUsage(
          'org-1',
          'invoices_per_month',
          50,
          new Date('2026-08-02T00:00:00Z'),
        ),
      );
      await expect(
        service.assertPeriodicAvailable('org-1', 'invoices_per_month'),
      ).resolves.toBeUndefined();
    });

    it('allows after period rollover (lastResetAt before period start)', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSubscription({ invoices_per_month: 100 }),
      );
      usageRepo.findOne.mockResolvedValue(
        makeUsage(
          'org-1',
          'invoices_per_month',
          100,
          new Date('2026-07-02T00:00:00Z'),
        ),
      );
      await expect(
        service.assertPeriodicAvailable('org-1', 'invoices_per_month'),
      ).resolves.toBeUndefined();
    });

    it('throws when usage reached the limit within the period', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSubscription({ invoices_per_month: 100 }),
      );
      usageRepo.findOne.mockResolvedValue(
        makeUsage(
          'org-1',
          'invoices_per_month',
          100,
          new Date('2026-08-02T00:00:00Z'),
        ),
      );
      const promise = service.assertPeriodicAvailable(
        'org-1',
        'invoices_per_month',
      );
      await expect(promise).rejects.toBeInstanceOf(PlanLimitExceededException);
    });
  });

  describe('consumePeriodic', () => {
    const now = new Date('2026-08-01T00:00:00Z');

    it('throws when the atomic UPDATE returns no row', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSubscription({ invoices_per_month: 100 }, now),
      );
      const manager = { query: jest.fn().mockResolvedValue([]) };
      const promise = service.consumePeriodic(
        'org-1',
        'invoices_per_month',
        manager as never,
      );
      await expect(promise).rejects.toBeInstanceOf(PlanLimitExceededException);
      expect(manager.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        ['org-1', 'invoices_per_month', now, 100],
      );
    });

    it('resolves when a row comes back', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSubscription({ invoices_per_month: 100 }, now),
      );
      const manager = {
        query: jest.fn().mockResolvedValue([{ id: 'usage-1' }]),
      };
      await expect(
        service.consumePeriodic(
          'org-1',
          'invoices_per_month',
          manager as never,
        ),
      ).resolves.toBeUndefined();
    });

    it('skips counting for unlimited resources', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSubscription({ invoices_per_month: -1 }, now),
      );
      const manager = { query: jest.fn() };
      await expect(
        service.consumePeriodic(
          'org-1',
          'invoices_per_month',
          manager as never,
        ),
      ).resolves.toBeUndefined();
      expect(manager.query).not.toHaveBeenCalled();
    });

    it('uses the data source when no manager is passed', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSubscription({ invoices_per_month: 100 }, now),
      );
      dataSource.query.mockResolvedValue([{ id: 'usage-1' }]);
      await expect(
        service.consumePeriodic('org-1', 'invoices_per_month'),
      ).resolves.toBeUndefined();
      expect(dataSource.query).toHaveBeenCalled();
    });
  });

  describe('usageSnapshot', () => {
    it('classifies entries by limit kind', async () => {
      subscriptionRepo.findOne.mockResolvedValue(
        makeSubscription({
          users: 5,
          invoices_per_month: 100,
          multi_branch: false,
        }),
      );
      usageRepo.find.mockResolvedValue([
        makeUsage(
          'org-1',
          'invoices_per_month',
          12,
          new Date('2026-08-02T00:00:00Z'),
        ),
      ]);

      const snapshot = await service.usageSnapshot('org-1');
      expect(snapshot.plan.code).toBe('starter');
      expect(snapshot.limits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            resource: 'users',
            kind: 'seat',
            limit: 5,
            current: null,
          }),
          expect.objectContaining({
            resource: 'invoices_per_month',
            kind: 'periodic',
            limit: 100,
            current: 12,
          }),
          expect.objectContaining({
            resource: 'multi_branch',
            kind: 'feature',
            limit: false,
            enabled: false,
          }),
        ]),
      );
    });
  });
});
