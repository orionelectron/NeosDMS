import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import type { SubscriptionStatus } from '../subscription.constants';
import { BillingPeriodEntity } from './billing-period.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { PlanEntity } from './plan.entity';
import { SubscriptionHistoryEntity } from './subscription-history.entity';
import { SubscriptionTransactionEntity } from './subscription-transaction.entity';

@Entity('subscriptions')
@Index('uq_subscriptions_one_live_per_org', ['organizationId'], {
  unique: true,
  where: "status IN ('trialing', 'active', 'past_due')",
})
@Check(
  'chk_subscriptions_status',
  "status IN ('trialing', 'active', 'past_due', 'canceled')",
)
@Check(
  'chk_subscriptions_period_order',
  'current_period_end >= current_period_start',
)
@Check('chk_subscriptions_amount', 'amount >= 0')
export class SubscriptionEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, (org) => org.subscriptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @ManyToOne(() => PlanEntity, (plan) => plan.subscriptions)
  @JoinColumn({ name: 'plan_id' })
  plan: PlanEntity;

  @Column({ name: 'billing_period_id', type: 'uuid' })
  billingPeriodId: string;

  @ManyToOne(() => BillingPeriodEntity, (period) => period.subscriptions)
  @JoinColumn({ name: 'billing_period_id' })
  billingPeriod: BillingPeriodEntity;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 3, default: 'NPR' })
  currency: string;

  @Column({ type: 'varchar', length: 16, default: 'trialing' })
  status: SubscriptionStatus;

  @Column({ name: 'trial_end_date', type: 'date', nullable: true })
  trialEndDate: Date | null;

  @Column({ name: 'current_period_start', type: 'timestamptz' })
  currentPeriodStart: Date;

  @Column({ name: 'current_period_end', type: 'timestamptz' })
  currentPeriodEnd: Date;

  @Column({ type: 'boolean', name: 'auto_renew', default: false })
  autoRenew: boolean;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt: Date | null;

  @Column({ name: 'grace_period_end', type: 'timestamptz', nullable: true })
  gracePeriodEnd: Date | null;

  @OneToMany(() => SubscriptionTransactionEntity, (tx) => tx.subscription)
  transactions: SubscriptionTransactionEntity[];

  @OneToMany(() => SubscriptionHistoryEntity, (history) => history.subscription)
  history: SubscriptionHistoryEntity[];
}
