import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { UserEntity } from '../../iam/entities/user.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { LeaveRequestStatus } from '../hr.constants';
import { LeaveTypeEntity } from './leave-type.entity';

/**
 * A leave request is a BS date range (decision 29). AD dates are stored for
 * calendar correctness; `from_bs_date`/`to_bs_date` canonical keys are used
 * for BS overlap checks and reporting.
 */
@Entity('leave_requests')
@Index('idx_leave_requests_org_user', ['organizationId', 'userId'])
@Index('idx_leave_requests_org_status', ['organizationId', 'status'])
export class LeaveRequestEntity extends BaseEntity {
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

  @Column({ name: 'leave_type_id', type: 'uuid' })
  leaveTypeId: string;

  @ManyToOne(() => LeaveTypeEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'leave_type_id' })
  leaveType: LeaveTypeEntity;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: LeaveRequestStatus;

  @Column({ name: 'from_date', type: 'date' })
  fromDate: string;

  @Column({ name: 'to_date', type: 'date' })
  toDate: string;

  @Column({ name: 'from_bs_date', type: 'varchar', length: 10 })
  fromBsDate: string;

  @Column({ name: 'to_bs_date', type: 'varchar', length: 10 })
  toBsDate: string;

  @Column({ type: 'integer' })
  days: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'reviewer_note', type: 'text', nullable: true })
  reviewerNote: string | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedByUser: UserEntity | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;
}
