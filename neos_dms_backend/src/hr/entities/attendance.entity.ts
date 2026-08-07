import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { UserEntity } from '../../iam/entities/user.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { AttendanceSource, AttendanceStatus } from '../hr.constants';

/**
 * An employee attendance record (decision 34): self-service check-in with an
 * optional check-out (GPS lat/long on both), a canonical `bs_date` key for
 * daily/monthly reports, and a derived `duration_minutes` computed on check-out.
 * `source` distinguishes device check-ins from manager manual corrections.
 * Exactly one OPEN record per user is enforced by a partial unique index.
 */
@Entity('attendances')
@Index('idx_attendances_org_user_bs', ['organizationId', 'userId', 'bsDate'])
@Index('idx_attendances_org_bs', ['organizationId', 'bsDate'])
export class AttendanceEntity extends BaseEntity {
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

  @Column({ name: 'bs_date', type: 'varchar', length: 10 })
  bsDate: string;

  @Column({ type: 'varchar', default: 'OPEN' })
  status: AttendanceStatus;

  @Column({ type: 'varchar', default: 'DEVICE' })
  source: AttendanceSource;

  @Column({ name: 'checkin_at', type: 'timestamptz' })
  checkinAt: Date;

  @Column({ name: 'checkin_remarks', type: 'text', nullable: true })
  checkinRemarks: string | null;

  @Column({
    name: 'checkin_latitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  checkinLatitude: string | null;

  @Column({
    name: 'checkin_longitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  checkinLongitude: string | null;

  @Column({ name: 'checkout_at', type: 'timestamptz', nullable: true })
  checkoutAt: Date | null;

  @Column({ name: 'checkout_remarks', type: 'text', nullable: true })
  checkoutRemarks: string | null;

  @Column({
    name: 'checkout_latitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  checkoutLatitude: string | null;

  @Column({
    name: 'checkout_longitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  checkoutLongitude: string | null;

  @Column({
    name: 'duration_minutes',
    type: 'integer',
    nullable: true,
  })
  durationMinutes: number | null;
}
