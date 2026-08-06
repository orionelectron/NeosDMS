import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  LIVE_SUBSCRIPTION_STATUSES,
  LIMIT_KIND,
  UNLIMITED,
  getLimitKind,
} from '../subscription.constants';
import {
  PlanFeatureUnavailableException,
  PlanLimitExceededException,
  NoActiveSubscriptionException,
} from '../subscription.errors';
import { OrganizationUsageEntity } from '../entities/organization-usage.entity';
import { SubscriptionEntity } from '../entities/subscription.entity';
import type { LimitValue } from '../subscription.constants';

/**
 * Atomic periodic-consume. Self-initializes the counter row on first use
 * (`INSERT ... ON CONFLICT`) and returns no row when the limit is already
 * reached within the current billing period — "no row = exceeded".
 * Rollover reset is inline (`last_reset_at < period_start`), no cron.
 */
const CONSUME_PERIODIC_SQL = `
  INSERT INTO organization_usages
    (id, organization_id, resource_code, current_usage, last_reset_at)
  VALUES (uuid_generate_v4(), $1, $2, 1, $3)
  ON CONFLICT (organization_id, resource_code) DO UPDATE SET
    current_usage = CASE
      WHEN organization_usages.last_reset_at < $3 THEN 1
      ELSE organization_usages.current_usage + 1
    END,
    last_reset_at = $3
  WHERE organization_usages.last_reset_at < $3
     OR organization_usages.current_usage < $4
  RETURNING id
`;

export interface UsageSnapshotEntry {
  resource: string;
  kind: (typeof LIMIT_KIND)[keyof typeof LIMIT_KIND];
  limit: LimitValue;
  current: number | null;
  enabled?: boolean;
  lastResetAt?: Date | null;
}

export interface UsageSnapshot {
  plan: { code: string; name: string };
  status: SubscriptionEntity['status'];
  period: { start: Date; end: Date };
  limits: UsageSnapshotEntry[];
}

@Injectable()
export class PlanLimitService {
  private readonly logger = new Logger(PlanLimitService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepo: Repository<SubscriptionEntity>,
    @InjectRepository(OrganizationUsageEntity)
    private readonly usageRepo: Repository<OrganizationUsageEntity>,
  ) {}

  /** Active subscription (trialing/active/past_due) with its plan loaded. */
  async requireActiveSubscription(
    organizationId: string,
    manager?: EntityManager,
  ): Promise<SubscriptionEntity> {
    const repo = manager
      ? manager.getRepository(SubscriptionEntity)
      : this.subscriptionRepo;
    const subscription = await repo.findOne({
      where: { organizationId, status: In(LIVE_SUBSCRIPTION_STATUSES) },
      relations: { plan: true },
    });
    if (!subscription) throw new NoActiveSubscriptionException();
    return subscription;
  }

  /** Limit value for a resource on the org's plan, or undefined if not in profile. */
  async getPlanLimit(
    organizationId: string,
    code: string,
  ): Promise<LimitValue | undefined> {
    const subscription = await this.requireActiveSubscription(organizationId);
    return subscription.plan.limits[code];
  }

  /**
   * Seat enforcement — the caller provides the live `COUNT` computed inside
   * its own transaction. Throws when `currentCount >= limit`. Pass a
   * `manager` to read the subscription inside the caller's transaction.
   */
  async assertSeat(
    organizationId: string,
    code: string,
    currentCount: number,
    manager?: EntityManager,
  ): Promise<void> {
    const subscription = await this.requireActiveSubscription(
      organizationId,
      manager,
    );
    const limit = subscription.plan.limits[code];
    if (typeof limit !== 'number' || limit === UNLIMITED) return;
    if (currentCount >= limit) {
      throw new PlanLimitExceededException(code, limit, currentCount);
    }
  }

  /** Feature gate — throws when the plan does not enable the feature. */
  async assertFeature(organizationId: string, code: string): Promise<void> {
    const subscription = await this.requireActiveSubscription(organizationId);
    const value = subscription.plan.limits[code];
    if (value === false) throw new PlanFeatureUnavailableException(code);
  }

  /**
   * Non-incrementing pre-check used by the `@PlanLimit` interceptor before
   * the handler runs. Does not touch counters.
   */
  async assertPeriodicAvailable(
    organizationId: string,
    code: string,
  ): Promise<void> {
    const subscription = await this.requireActiveSubscription(organizationId);
    const limit = subscription.plan.limits[code];
    if (typeof limit !== 'number' || limit === UNLIMITED) return;

    const usage = await this.usageRepo.findOne({
      where: { organizationId, resourceCode: code },
    });
    const expired =
      !usage?.lastResetAt ||
      usage.lastResetAt < subscription.currentPeriodStart;
    if (expired) return;

    if ((usage?.currentUsage ?? 0) >= limit) {
      throw new PlanLimitExceededException(
        code,
        limit,
        usage?.currentUsage ?? 0,
      );
    }
  }

  /**
   * Atomic periodic consume — runs inside the caller's transaction when a
   * `manager` is passed (recommended for money/stock flows), otherwise on
   * the data source. Throws `PLAN_LIMIT_EXCEEDED` when no row comes back.
   */
  async consumePeriodic(
    organizationId: string,
    code: string,
    manager?: EntityManager,
  ): Promise<void> {
    const subscription = await this.requireActiveSubscription(organizationId);
    const limit = subscription.plan.limits[code];
    if (typeof limit !== 'number' || limit === UNLIMITED) return;

    const em = manager ?? this.dataSource;
    const rows = await em.query<Array<Record<string, unknown>>>(
      CONSUME_PERIODIC_SQL,
      [organizationId, code, subscription.currentPeriodStart, limit],
    );

    if (!rows || rows.length === 0) {
      throw new PlanLimitExceededException(code, limit, limit);
    }
  }

  /** Current vs limit per resource on the org's plan. Seat counts are computed at call sites. */
  async usageSnapshot(organizationId: string): Promise<UsageSnapshot> {
    const subscription = await this.requireActiveSubscription(organizationId);
    const limits = subscription.plan.limits;
    const usageRows = await this.usageRepo.find({
      where: { organizationId },
    });
    const usageByCode = new Map(
      usageRows.map((row) => [row.resourceCode, row]),
    );

    const entries: UsageSnapshotEntry[] = Object.keys(limits).map((code) => {
      const limit = limits[code];
      const kind = getLimitKind(code);
      const usage = usageByCode.get(code);

      if (kind === LIMIT_KIND.FEATURE) {
        return {
          resource: code,
          kind,
          limit,
          current: null,
          enabled: limit === true,
        };
      }
      if (kind === LIMIT_KIND.PERIODIC) {
        return {
          resource: code,
          kind,
          limit,
          current: usage?.currentUsage ?? 0,
          lastResetAt: usage?.lastResetAt ?? null,
        };
      }
      return {
        resource: code,
        kind,
        limit,
        current: null,
      };
    });

    return {
      plan: { code: subscription.plan.code, name: subscription.plan.name },
      status: subscription.status,
      period: {
        start: subscription.currentPeriodStart,
        end: subscription.currentPeriodEnd,
      },
      limits: entries,
    };
  }
}
