import { Check, Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import type { PlanLimits } from '../subscription.constants';
import { PriceMatrixEntity } from './price-matrix.entity';
import { SubscriptionEntity } from './subscription.entity';

@Entity('plans')
@Check('chk_plans_grace_period_days', 'grace_period_days >= 0')
export class PlanEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  code: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int', name: 'grace_period_days', default: 3 })
  gracePeriodDays: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: {} })
  limits: PlanLimits;

  @OneToMany(() => PriceMatrixEntity, (matrix) => matrix.plan)
  priceMatrices: PriceMatrixEntity[];

  @OneToMany(() => SubscriptionEntity, (sub) => sub.plan)
  subscriptions: SubscriptionEntity[];
}
