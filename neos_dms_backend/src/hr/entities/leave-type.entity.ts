import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';

/**
 * Org-scoped leave catalogue (decision 29). The company defines paid/unpaid
 * leave categories once; balances and requests reference these.
 */
@Entity('leave_types')
@Index('uq_leave_types_org_code', ['organizationId', 'code'], { unique: true })
@Index('idx_leave_types_org', ['organizationId'])
export class LeaveTypeEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ type: 'varchar' })
  code: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ name: 'is_paid', type: 'boolean', default: true })
  isPaid: boolean;

  @Column({ name: 'days_per_year', type: 'integer', default: 0 })
  daysPerYear: number;

  @Column({ name: 'carryover_limit_days', type: 'integer', default: 0 })
  carryoverLimitDays: number;

  @Column({ name: 'max_consecutive_days', type: 'integer', default: 0 })
  maxConsecutiveDays: number;

  @Column({ name: 'requires_balance', type: 'boolean', default: true })
  requiresBalance: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
