import { Check, Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { PriceMatrixEntity } from './price-matrix.entity';
import { SubscriptionEntity } from './subscription.entity';

@Entity('billing_periods')
@Check('chk_billing_periods_duration_days', 'duration_days > 0')
export class BillingPeriodEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  name: string;

  @Column({ type: 'int', name: 'duration_days' })
  durationDays: number;

  @OneToMany(() => PriceMatrixEntity, (matrix) => matrix.billingPeriod)
  priceMatrices: PriceMatrixEntity[];

  @OneToMany(() => SubscriptionEntity, (sub) => sub.billingPeriod)
  subscriptions: SubscriptionEntity[];
}
