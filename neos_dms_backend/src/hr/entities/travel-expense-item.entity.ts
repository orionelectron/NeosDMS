import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { ExpenseCategory } from '../hr.constants';
import { TravelExpenseClaimEntity } from './travel-expense-claim.entity';

/**
 * A claim line item (decision 33). `approved_amount` is what the accountant
 * reimbures — it defaults to `amount` and may be adjusted at pay time; the
 * claim `total` is re-derived from it.
 */
@Entity('travel_expense_items')
@Index('idx_travel_items_org_claim', ['organizationId', 'claimId'])
export class TravelExpenseItemEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'claim_id', type: 'uuid' })
  claimId: string;

  @ManyToOne(() => TravelExpenseClaimEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'claim_id' })
  claim: TravelExpenseClaimEntity;

  @Column({ name: 'bs_date', type: 'varchar', length: 10 })
  bsDate: string;

  @Column({ type: 'varchar' })
  category: ExpenseCategory;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  @Column({ name: 'approved_amount', type: 'numeric', precision: 14, scale: 2 })
  approvedAmount: string;

  @Column({ name: 'receipt_key', type: 'varchar', nullable: true })
  receiptKey: string | null;
}
