import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { SubscriptionEntity } from './subscription.entity';

@Entity('subscription_history')
export class SubscriptionHistoryEntity extends BaseEntity {
  @Column({ name: 'subscription_id', type: 'uuid' })
  subscriptionId: string;

  @ManyToOne(() => SubscriptionEntity, (sub) => sub.history, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'subscription_id' })
  subscription: SubscriptionEntity;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId: string | null;

  @Column({ type: 'varchar' })
  status: string;

  @Column({
    name: 'changed_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  changedAt: Date;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;
}
