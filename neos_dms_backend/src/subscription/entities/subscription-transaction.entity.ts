import { Check, Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import type { TransactionStatus } from '../subscription.constants';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { SubscriptionEntity } from './subscription.entity';

@Entity('subscription_transactions')
@Check(
  'chk_subscription_transactions_status',
  "status IN ('pending', 'completed', 'failed', 'refunded')",
)
@Check('chk_subscription_transactions_amount', 'amount >= 0')
export class SubscriptionTransactionEntity extends BaseEntity {
  @Column({ name: 'subscription_id', type: 'uuid' })
  subscriptionId: string;

  @ManyToOne(() => SubscriptionEntity, (sub) => sub.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'subscription_id' })
  subscription: SubscriptionEntity;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ type: 'varchar', name: 'invoice_number', unique: true })
  invoiceNumber: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 3, default: 'NPR' })
  currency: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: TransactionStatus;

  @Column({ type: 'varchar', name: 'payment_gateway', nullable: true })
  paymentGateway: string | null;

  @Column({
    type: 'varchar',
    name: 'gateway_transaction_id',
    unique: true,
    nullable: true,
  })
  gatewayTransactionId: string | null;

  @Column({ name: 'gateway_payload', type: 'jsonb', nullable: true })
  gatewayPayload: Record<string, unknown> | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;
}
