import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  LIVE_SUBSCRIPTION_STATUSES,
  DEFAULT_GRACE_PERIOD_DAYS,
  DEFAULT_TRIAL_DAYS,
  SUBSCRIPTION_STATUS,
} from './subscription.constants';
import {
  NoActiveSubscriptionException,
  PlanNotFoundException,
  SubscriptionConflictException,
} from './subscription.errors';
import { BillingPeriodEntity } from './entities/billing-period.entity';
import { PlanEntity } from './entities/plan.entity';
import { PriceMatrixEntity } from './entities/price-matrix.entity';
import { SubscriptionEntity } from './entities/subscription.entity';
import { SubscriptionHistoryEntity } from './entities/subscription-history.entity';
import { SubscriptionTransactionEntity } from './entities/subscription-transaction.entity';

export interface CreateSubscriptionOptions {
  periodName: string;
  status?: (typeof SUBSCRIPTION_STATUS)[number];
  trialDays?: number;
  changedBy?: string | null;
  reason?: string | null;
  manager?: EntityManager;
}

export interface RecordPaymentInput {
  organizationId: string;
  invoiceNumber: string;
  amount: string;
  currency?: string;
  paymentGateway?: string | null;
  gatewayTransactionId?: string | null;
  gatewayPayload?: Record<string, unknown> | null;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepo: Repository<SubscriptionEntity>,
    @InjectRepository(PlanEntity)
    private readonly planRepo: Repository<PlanEntity>,
    @InjectRepository(BillingPeriodEntity)
    private readonly periodRepo: Repository<BillingPeriodEntity>,
    @InjectRepository(PriceMatrixEntity)
    private readonly priceMatrixRepo: Repository<PriceMatrixEntity>,
    @InjectRepository(SubscriptionTransactionEntity)
    private readonly transactionRepo: Repository<SubscriptionTransactionEntity>,
    @InjectRepository(SubscriptionHistoryEntity)
    private readonly historyRepo: Repository<SubscriptionHistoryEntity>,
  ) {}

  /** Public plan catalog with current price points per billing period. */
  async getCatalog(): Promise<unknown[]> {
    const plans = await this.planRepo.find({
      where: { isActive: true },
      relations: { priceMatrices: { billingPeriod: true } },
      order: { code: 'ASC' },
    });

    return plans.map((plan) => ({
      code: plan.code,
      name: plan.name,
      description: plan.description,
      gracePeriodDays: plan.gracePeriodDays,
      limits: plan.limits,
      pricing: plan.priceMatrices
        .filter((matrix) => matrix.isCurrent)
        .map((matrix) => ({
          period: matrix.billingPeriod.name,
          durationDays: matrix.billingPeriod.durationDays,
          basePrice: matrix.basePrice,
          currency: matrix.currency,
          isTaxInclusive: matrix.isTaxInclusive,
        })),
    }));
  }

  /** Org's current subscription (trialing/active/past_due) with plan + period. */
  getActive(organizationId: string): Promise<SubscriptionEntity | null> {
    return this.subscriptionRepo.findOne({
      where: {
        organizationId,
        status: In(LIVE_SUBSCRIPTION_STATUSES),
      },
      relations: { plan: true, billingPeriod: true },
    });
  }

  /** Onboarding: create the org's trial subscription (starter plan by default). */
  async startTrial(
    organizationId: string,
    planCode: string,
    options: CreateSubscriptionOptions,
  ): Promise<SubscriptionEntity> {
    const run = (manager: EntityManager) =>
      this.createSubscription(organizationId, planCode, {
        ...options,
        manager,
        status: options.status ?? 'trialing',
        trialDays: options.trialDays ?? DEFAULT_TRIAL_DAYS,
        reason: options.reason ?? 'trial-started',
      });

    if (options.manager) return run(options.manager);
    return this.dataSource.transaction((manager) => run(manager));
  }

  /** Upgrade/downgrade: cancel the live subscription, create the new one as active. */
  async changePlan(
    organizationId: string,
    planCode: string,
    periodName: string,
    changedBy: string | null,
  ): Promise<SubscriptionEntity> {
    return this.dataSource.transaction(async (manager) => {
      const current = await manager.findOne(SubscriptionEntity, {
        where: {
          organizationId,
          status: In(LIVE_SUBSCRIPTION_STATUSES),
        },
      });
      if (!current) throw new NoActiveSubscriptionException();

      const now = new Date();
      await manager.update(
        SubscriptionEntity,
        { id: current.id },
        { status: 'canceled', canceledAt: now },
      );
      await manager.save(
        manager.create(SubscriptionHistoryEntity, {
          subscriptionId: current.id,
          planId: current.planId,
          status: 'canceled',
          changedAt: now,
          changedBy,
          reason: `plan-change: ${planCode}`,
        }),
      );

      return this.createSubscription(organizationId, planCode, {
        periodName,
        status: 'active',
        changedBy,
        reason: 'plan-changed',
        manager,
      });
    });
  }

  /** Cancel the org's live subscription. */
  async cancel(
    organizationId: string,
    reason: string | null,
    changedBy: string | null,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const current = await manager.findOne(SubscriptionEntity, {
        where: {
          organizationId,
          status: In(LIVE_SUBSCRIPTION_STATUSES),
        },
      });
      if (!current) return;

      const now = new Date();
      await manager.update(
        SubscriptionEntity,
        { id: current.id },
        { status: 'canceled', canceledAt: now },
      );
      await manager.save(
        manager.create(SubscriptionHistoryEntity, {
          subscriptionId: current.id,
          planId: current.planId,
          status: 'canceled',
          changedAt: now,
          changedBy,
          reason,
        }),
      );
    });
  }

  /** Payment failed: move trialing/active → past_due with a grace window. */
  async markPastDue(
    organizationId: string,
    reason: string | null,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const current = await manager.findOne(SubscriptionEntity, {
        where: {
          organizationId,
          status: In(LIVE_SUBSCRIPTION_STATUSES),
        },
      });
      if (!current || current.status === 'past_due') return;

      const now = new Date();
      const plan = await manager.findOne(PlanEntity, {
        where: { id: current.planId },
      });
      const graceDays = plan?.gracePeriodDays ?? DEFAULT_GRACE_PERIOD_DAYS;

      await manager.update(
        SubscriptionEntity,
        { id: current.id },
        {
          status: 'past_due',
          gracePeriodEnd: addDays(now, graceDays),
        },
      );
      await manager.save(
        manager.create(SubscriptionHistoryEntity, {
          subscriptionId: current.id,
          planId: current.planId,
          status: 'past_due',
          changedAt: now,
          changedBy: null,
          reason,
        }),
      );
    });
  }

  /**
   * Record a completed gateway payment. Idempotent on
   * `gateway_transaction_id` (webhook replay-safe). Converts a trialing
   * subscription to active on first successful payment.
   */
  async recordPayment(input: RecordPaymentInput): Promise<{
    transaction: SubscriptionTransactionEntity;
    replayed: boolean;
  }> {
    return this.dataSource.transaction(async (manager) => {
      if (input.gatewayTransactionId) {
        const existing = await manager.findOne(SubscriptionTransactionEntity, {
          where: { gatewayTransactionId: input.gatewayTransactionId },
        });
        if (existing) return { transaction: existing, replayed: true };
      }

      const subscription = await manager.findOne(SubscriptionEntity, {
        where: {
          organizationId: input.organizationId,
          status: In(LIVE_SUBSCRIPTION_STATUSES),
        },
      });
      if (!subscription) throw new NoActiveSubscriptionException();

      const now = new Date();
      const transaction = await manager.save(
        manager.create(SubscriptionTransactionEntity, {
          subscriptionId: subscription.id,
          organizationId: input.organizationId,
          invoiceNumber: input.invoiceNumber,
          amount: input.amount,
          currency: input.currency ?? 'NPR',
          status: 'completed',
          paymentGateway: input.paymentGateway ?? null,
          gatewayTransactionId: input.gatewayTransactionId ?? null,
          gatewayPayload: input.gatewayPayload ?? null,
          paidAt: now,
        }),
      );

      if (subscription.status === 'trialing') {
        await manager.update(
          SubscriptionEntity,
          { id: subscription.id },
          { status: 'active' },
        );
        await manager.save(
          manager.create(SubscriptionHistoryEntity, {
            subscriptionId: subscription.id,
            planId: subscription.planId,
            status: 'active',
            changedAt: now,
            changedBy: null,
            reason: 'trial-converted',
          }),
        );
      }

      return { transaction, replayed: false };
    });
  }

  /** Subscription state timeline, newest first. */
  async history(
    organizationId: string,
    page: number,
    limit: number,
  ): Promise<[SubscriptionHistoryEntity[], number]> {
    return this.historyRepo
      .createQueryBuilder('history')
      .innerJoin('history.subscription', 'subscription')
      .where('subscription.organization_id = :organizationId', {
        organizationId,
      })
      .orderBy('history.changedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
  }

  /** Payment transactions for the org, newest first. */
  async transactions(
    organizationId: string,
    page: number,
    limit: number,
  ): Promise<[SubscriptionTransactionEntity[], number]> {
    return this.transactionRepo.findAndCount({
      where: { organizationId },
      order: { paidAt: 'DESC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  private async createSubscription(
    organizationId: string,
    planCode: string,
    options: CreateSubscriptionOptions,
  ): Promise<SubscriptionEntity> {
    const manager: EntityManager = options.manager ?? this.dataSource.manager;

    const plan = await manager.findOne(PlanEntity, {
      where: { code: planCode, isActive: true },
    });
    if (!plan) throw new PlanNotFoundException(planCode);

    const period = await manager.findOne(BillingPeriodEntity, {
      where: { name: options.periodName },
    });
    if (!period) {
      throw new PlanNotFoundException(`billing period '${options.periodName}'`);
    }

    const matrix = await manager.findOne(PriceMatrixEntity, {
      where: {
        planId: plan.id,
        billingPeriodId: period.id,
        isCurrent: true,
      },
    });
    if (!matrix) {
      throw new PlanNotFoundException(
        `pricing for plan '${planCode}' / '${options.periodName}'`,
      );
    }

    const now = new Date();
    const trialDays =
      options.status === 'trialing'
        ? (options.trialDays ?? DEFAULT_TRIAL_DAYS)
        : 0;
    const subscription = manager.create(SubscriptionEntity, {
      organizationId,
      planId: plan.id,
      billingPeriodId: period.id,
      amount: matrix.basePrice,
      currency: matrix.currency,
      status: options.status ?? 'trialing',
      trialEndDate: trialDays > 0 ? addDays(now, trialDays) : null,
      currentPeriodStart: now,
      currentPeriodEnd: addDays(now, period.durationDays),
      autoRenew: false,
    });

    try {
      await manager.save(subscription);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new SubscriptionConflictException();
      }
      throw error;
    }

    await manager.save(
      manager.create(SubscriptionHistoryEntity, {
        subscriptionId: subscription.id,
        planId: plan.id,
        status: subscription.status,
        changedAt: now,
        changedBy: options.changedBy ?? null,
        reason: options.reason ?? null,
      }),
    );

    return subscription;
  }

  private isUniqueViolation(error: unknown): boolean {
    if (error && typeof error === 'object' && 'code' in error) {
      return (error as { code: string }).code === '23505';
    }
    return false;
  }
}
