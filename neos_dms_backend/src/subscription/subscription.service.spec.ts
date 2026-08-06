import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { BillingPeriodEntity } from './entities/billing-period.entity';
import { PlanEntity } from './entities/plan.entity';
import { PriceMatrixEntity } from './entities/price-matrix.entity';
import { SubscriptionEntity } from './entities/subscription.entity';
import { SubscriptionHistoryEntity } from './entities/subscription-history.entity';
import { SubscriptionTransactionEntity } from './entities/subscription-transaction.entity';
import {
  NoActiveSubscriptionException,
  PlanNotFoundException,
} from './subscription.errors';
import { SubscriptionService } from './subscription.service';

function makeEntity<T extends object>(
  Entity: new () => T,
  data: Partial<T>,
): T {
  return Object.assign(Object.create(Entity.prototype as object) as T, data);
}

interface Store {
  plans: PlanEntity[];
  periods: BillingPeriodEntity[];
  matrices: PriceMatrixEntity[];
  subscriptions: SubscriptionEntity[];
  transactions: SubscriptionTransactionEntity[];
  history: SubscriptionHistoryEntity[];
}

function createManager(store: Store) {
  const listFor = (Entity: new () => unknown): unknown[] => {
    if (Entity === PlanEntity) return store.plans;
    if (Entity === BillingPeriodEntity) return store.periods;
    if (Entity === PriceMatrixEntity) return store.matrices;
    if (Entity === SubscriptionEntity) return store.subscriptions;
    if (Entity === SubscriptionTransactionEntity) return store.transactions;
    if (Entity === SubscriptionHistoryEntity) return store.history;
    return [];
  };

  const valueMatches = (
    item: Record<string, unknown>,
    key: string,
    value: unknown,
  ): boolean => {
    const current = item[key];
    if (
      value &&
      typeof value === 'object' &&
      (value as { _type?: string })._type === 'in'
    ) {
      return (value as { _value: unknown[] })._value.includes(current);
    }
    return current === value;
  };

  return {
    create: jest.fn((Entity: new () => object, data: object) =>
      Object.assign(Object.create(Entity.prototype as object) as object, data),
    ),
    save: jest.fn((entity: { id?: string }) => {
      const list = listFor(entity.constructor) as Array<{
        id?: string;
      }>;
      if (!entity.id) {
        entity.id = randomUUID();
        list.push(entity);
      } else {
        const index = list.findIndex((entry) => entry.id === entity.id);
        if (index === -1) list.push(entity);
        else list[index] = entity;
      }
      return entity;
    }),
    findOne: jest.fn(
      (
        Entity: new () => unknown,
        options: { where?: Record<string, unknown> },
      ) => {
        const list = listFor(Entity) as Array<Record<string, unknown>>;
        const where = options?.where ?? {};
        return (
          list.find((item) =>
            Object.entries(where).every(([key, value]) =>
              valueMatches(item, key, value),
            ),
          ) ?? null
        );
      },
    ),
    update: jest.fn(
      (
        Entity: new () => unknown,
        criteria: { id: string },
        patch: Record<string, unknown>,
      ) => {
        const list = listFor(Entity) as Array<Record<string, unknown>>;
        const item = list.find((entry) => entry.id === criteria.id);
        if (item) Object.assign(item, patch);
        return { affected: item ? 1 : 0 };
      },
    ),
  };
}

function seedStore(organizationId: string, limits = {}): Store {
  const plan = makeEntity(PlanEntity, {
    id: 'plan-starter',
    code: 'starter',
    name: 'Starter',
    isActive: true,
    limits,
  });
  const period = makeEntity(BillingPeriodEntity, {
    id: 'period-monthly',
    name: 'Monthly',
    durationDays: 30,
  });
  const matrix = makeEntity(PriceMatrixEntity, {
    id: 'matrix-1',
    planId: plan.id,
    billingPeriodId: period.id,
    basePrice: '1499.00',
    currency: 'NPR',
    isCurrent: true,
  });
  const subscription = makeEntity(SubscriptionEntity, {
    id: 'sub-1',
    organizationId,
    planId: plan.id,
    billingPeriodId: period.id,
    amount: matrix.basePrice,
    currency: 'NPR',
    status: 'trialing',
    currentPeriodStart: new Date('2026-08-01T00:00:00Z'),
    currentPeriodEnd: new Date('2026-08-31T00:00:00Z'),
  });
  return {
    plans: [plan],
    periods: [period],
    matrices: [matrix],
    subscriptions: [subscription],
    transactions: [],
    history: [],
  };
}

describe('SubscriptionService', () => {
  const orgId = 'org-1';
  let service: SubscriptionService;
  let store: Store;
  let dataSource: { transaction: jest.Mock };
  let transactionRepo: { findAndCount: jest.Mock };
  let manager: ReturnType<typeof createManager>;

  beforeEach(async () => {
    store = seedStore(orgId);
    manager = createManager(store);
    dataSource = {
      transaction: jest.fn((fn: (m: unknown) => unknown) => fn(manager)),
    };
    transactionRepo = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getRepositoryToken(SubscriptionEntity), useValue: {} },
        { provide: getRepositoryToken(PlanEntity), useValue: {} },
        { provide: getRepositoryToken(BillingPeriodEntity), useValue: {} },
        { provide: getRepositoryToken(PriceMatrixEntity), useValue: {} },
        {
          provide: getRepositoryToken(SubscriptionTransactionEntity),
          useValue: transactionRepo,
        },
        {
          provide: getRepositoryToken(SubscriptionHistoryEntity),
          useValue: {},
        },
      ],
    }).compile();

    service = moduleRef.get(SubscriptionService);
  });

  describe('startTrial', () => {
    it('creates a trial subscription with price snapshot and history', async () => {
      const result = await service.startTrial(orgId, 'starter', {
        periodName: 'Monthly',
      });

      expect(result.status).toBe('trialing');
      expect(result.amount).toBe('1499.00');
      expect(store.history).toHaveLength(1);
      expect(store.history[0]).toMatchObject({
        status: 'trialing',
        reason: 'trial-started',
      });
    });

    it('throws PlanNotFoundException for an unknown plan', async () => {
      await expect(
        service.startTrial(orgId, 'nope', { periodName: 'Monthly' }),
      ).rejects.toThrow(PlanNotFoundException);
    });
  });

  describe('changePlan', () => {
    it('cancels the current subscription and creates a new active one', async () => {
      const result = await service.changePlan(
        orgId,
        'starter',
        'Monthly',
        null,
      );

      const canceled = store.subscriptions.find((sub) => sub.id === 'sub-1');
      expect(canceled?.status).toBe('canceled');
      expect(canceled?.canceledAt).toBeInstanceOf(Date);

      expect(result.status).toBe('active');
      expect(store.history.map((entry) => entry.reason)).toEqual(
        expect.arrayContaining(['plan-change: starter', 'plan-changed']),
      );
    });

    it('throws when there is no live subscription', async () => {
      store.subscriptions = [];
      await expect(
        service.changePlan(orgId, 'starter', 'Monthly', null),
      ).rejects.toThrow(NoActiveSubscriptionException);
    });
  });

  describe('cancel', () => {
    it('is a no-op when there is no live subscription', async () => {
      store.subscriptions = [];
      await expect(
        service.cancel(orgId, 'reason', null),
      ).resolves.toBeUndefined();
      expect(store.history).toHaveLength(0);
    });

    it('cancels the live subscription and writes history', async () => {
      await service.cancel(orgId, 'not needed', null);
      expect(store.subscriptions[0].status).toBe('canceled');
      expect(store.history[0]).toMatchObject({
        status: 'canceled',
        reason: 'not needed',
      });
    });
  });

  describe('recordPayment', () => {
    it('records a completed transaction and converts trial to active', async () => {
      const { transaction, replayed } = await service.recordPayment({
        organizationId: orgId,
        invoiceNumber: 'INV-1',
        amount: '1499.00',
        gatewayTransactionId: 'gw-1',
      });

      expect(replayed).toBe(false);
      expect(transaction.status).toBe('completed');
      expect(store.subscriptions[0].status).toBe('active');
      expect(store.history).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: 'active',
            reason: 'trial-converted',
          }),
        ]),
      );
    });

    it('is idempotent on gatewayTransactionId (webhook replay-safe)', async () => {
      const first = await service.recordPayment({
        organizationId: orgId,
        invoiceNumber: 'INV-1',
        amount: '1499.00',
        gatewayTransactionId: 'gw-1',
      });
      expect(first.replayed).toBe(false);

      const replay = await service.recordPayment({
        organizationId: orgId,
        invoiceNumber: 'INV-1',
        amount: '1499.00',
        gatewayTransactionId: 'gw-1',
      });
      expect(replay.replayed).toBe(true);
      expect(replay.transaction.id).toBe(first.transaction.id);
      expect(store.transactions).toHaveLength(1);
    });

    it('throws when the organization has no live subscription', async () => {
      store.subscriptions = [];
      await expect(
        service.recordPayment({
          organizationId: orgId,
          invoiceNumber: 'INV-2',
          amount: '1499.00',
        }),
      ).rejects.toThrow(NoActiveSubscriptionException);
    });
  });

  it('lists transactions through the injected repository', async () => {
    transactionRepo.findAndCount.mockResolvedValue([[], 0]);
    const [rows, total] = await service.transactions(orgId, 1, 20);
    expect(rows).toEqual([]);
    expect(total).toBe(0);
    expect(transactionRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: orgId } }),
    );
  });
});
