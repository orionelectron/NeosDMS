import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { UserEntity } from '../../iam/entities/user.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { ExpenseClaimStatus } from '../hr.constants';
import { TravelExpenseItemEntity } from './travel-expense-item.entity';
import { TravelRequestEntity } from './travel-request.entity';

/**
 * A travel expense claim over a BS period (decision 31/33): the manager
 * approves (`APPROVED`), then the accountant pays (`PAID`). `total` is always
 * derived from the item lines — never client-supplied.
 */
@Entity('travel_expense_claims')
@Index('idx_travel_claims_org_user', ['organizationId', 'userId'])
@Index('idx_travel_claims_org_status', ['organizationId', 'status'])
export class TravelExpenseClaimEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'travel_request_id', type: 'uuid', nullable: true })
  travelRequestId: string | null;

  @ManyToOne(() => TravelRequestEntity, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'travel_request_id' })
  travelRequest: TravelRequestEntity | null;

  @Column({ name: 'from_date', type: 'date' })
  fromDate: string;

  @Column({ name: 'to_date', type: 'date' })
  toDate: string;

  @Column({ name: 'from_bs_date', type: 'varchar', length: 10 })
  fromBsDate: string;

  @Column({ name: 'to_bs_date', type: 'varchar', length: 10 })
  toBsDate: string;

  @Column({
    name: 'total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  total: string;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: ExpenseClaimStatus;

  @Column({ name: 'reviewer_note', type: 'text', nullable: true })
  reviewerNote: string | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedByUser: UserEntity | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'paid_by', type: 'uuid', nullable: true })
  paidBy: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'paid_by' })
  paidByUser: UserEntity | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @OneToMany(() => TravelExpenseItemEntity, (item) => item.claim)
  items: TravelExpenseItemEntity[];
}
