import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { UserEntity } from '../../iam/entities/user.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { LeaveTypeEntity } from './leave-type.entity';

/**
 * Annual leave entitlement per BS calendar year (decision 29). Available =
 * `entitled_days + carryover_days - used_days`. Approval consumes `used_days`
 * inside a transaction so a balance can never go negative.
 */
@Entity('leave_balances')
@Index(
  'uq_leave_balances_org_user_type_year',
  ['organizationId', 'userId', 'leaveTypeId', 'bsYear'],
  { unique: true },
)
@Index('idx_leave_balances_org_user', ['organizationId', 'userId'])
export class LeaveBalanceEntity extends BaseEntity {
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

  @Column({ name: 'bs_year', type: 'integer' })
  bsYear: number;

  @Column({
    name: 'entitled_days',
    type: 'numeric',
    precision: 6,
    scale: 1,
    default: 0,
  })
  entitledDays: string;

  @Column({
    name: 'carryover_days',
    type: 'numeric',
    precision: 6,
    scale: 1,
    default: 0,
  })
  carryoverDays: string;

  @Column({
    name: 'used_days',
    type: 'numeric',
    precision: 6,
    scale: 1,
    default: 0,
  })
  usedDays: string;
}
