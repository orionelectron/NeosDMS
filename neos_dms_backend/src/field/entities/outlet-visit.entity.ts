import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { UserEntity } from '../../iam/entities/user.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { VisitStatus, VisitType } from '../field.constants';
import { OutletEntity } from './outlet.entity';
import { RouteEntity } from './route.entity';

@Entity('outlet_visits')
@Index('idx_outlet_visits_org_user', ['organizationId', 'userId'])
@Index('idx_outlet_visits_org_route', ['organizationId', 'routeId'])
@Index('idx_outlet_visits_org_outlet', ['organizationId', 'outletId'])
export class OutletVisitEntity extends BaseEntity {
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

  @Column({ name: 'route_id', type: 'uuid' })
  routeId: string;

  @ManyToOne(() => RouteEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route: RouteEntity;

  @Column({ name: 'outlet_id', type: 'uuid' })
  outletId: string;

  @ManyToOne(() => OutletEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet: OutletEntity;

  @Column({ name: 'visit_type', type: 'varchar', default: 'PLANNED' })
  visitType: VisitType;

  @Column({ type: 'varchar', default: 'SCHEDULED' })
  status: VisitStatus;

  @Column({ name: 'checked_in_at', type: 'timestamptz', nullable: true })
  checkedInAt: Date | null;

  @Column({ name: 'checked_out_at', type: 'timestamptz', nullable: true })
  checkedOutAt: Date | null;

  @Column({
    name: 'check_in_latitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  checkInLatitude: string | null;

  @Column({
    name: 'check_in_longitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  checkInLongitude: string | null;

  @Column({
    name: 'check_out_latitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  checkOutLatitude: string | null;

  @Column({
    name: 'check_out_longitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  checkOutLongitude: string | null;

  @Column({
    name: 'distance_from_outlet_meters',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  distanceFromOutletMeters: string | null;

  @Column({ name: 'is_off_route', type: 'boolean', nullable: true })
  isOffRoute: boolean | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ name: 'photo_key', type: 'varchar', nullable: true })
  photoKey: string | null;
}
