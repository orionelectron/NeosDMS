import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { UserEntity } from '../../iam/entities/user.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { TransportMode, TravelRequestStatus } from '../hr.constants';

/**
 * An employee travel pre-approval (decision 32): manager-only approval via
 * `users.manager_id`, same hierarchy as leave. AD dates stored for calendar
 * correctness; BS canonical keys used for range checks and reporting.
 */
@Entity('travel_requests')
@Index('idx_travel_requests_org_user', ['organizationId', 'userId'])
@Index('idx_travel_requests_org_status', ['organizationId', 'status'])
export class TravelRequestEntity extends BaseEntity {
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

  @Column({ type: 'text' })
  purpose: string;

  @Column({ name: 'from_date', type: 'date' })
  fromDate: string;

  @Column({ name: 'to_date', type: 'date' })
  toDate: string;

  @Column({ name: 'from_bs_date', type: 'varchar', length: 10 })
  fromBsDate: string;

  @Column({ name: 'to_bs_date', type: 'varchar', length: 10 })
  toBsDate: string;

  @Column({ name: 'transport_mode', type: 'varchar' })
  transportMode: TransportMode;

  @Column({
    name: 'estimated_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  estimatedCost: string;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: TravelRequestStatus;

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
