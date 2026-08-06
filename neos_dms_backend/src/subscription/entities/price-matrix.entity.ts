import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { BillingPeriodEntity } from './billing-period.entity';
import { PlanEntity } from './plan.entity';

@Entity('price_matrices')
@Index('uq_price_matrices_current_price_point', ['planId', 'billingPeriodId'], {
  unique: true,
  where: '"is_current" = true',
})
@Check('chk_price_matrices_base_price', 'base_price >= 0')
export class PriceMatrixEntity extends BaseEntity {
  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @ManyToOne(() => PlanEntity, (plan) => plan.priceMatrices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_id' })
  plan: PlanEntity;

  @Column({ name: 'billing_period_id', type: 'uuid' })
  billingPeriodId: string;

  @ManyToOne(() => BillingPeriodEntity, (period) => period.priceMatrices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'billing_period_id' })
  billingPeriod: BillingPeriodEntity;

  @Column({
    name: 'base_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  basePrice: string;

  @Column({ type: 'varchar', length: 3, default: 'NPR' })
  currency: string;

  @Column({ type: 'boolean', name: 'is_tax_inclusive', default: false })
  isTaxInclusive: boolean;

  @Column({ type: 'timestamptz', name: 'valid_from', default: () => 'now()' })
  validFrom: Date;

  @Column({ type: 'boolean', name: 'is_current', default: true })
  isCurrent: boolean;

  @Column({
    name: 'superseded_at',
    type: 'timestamptz',
    nullable: true,
  })
  supersededAt: Date | null;
}
