import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { UserEntity } from '../../iam/entities/user.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { RouteEntity } from './route.entity';

/**
 * A salesman (user) owns a route on a set of weekdays (ISO-8601 day numbers,
 * e.g. `[1,3,5]` = Mon/Wed/Fri). One user-route pair is unique per org.
 */
@Entity('route_assignments')
@Index(
  'uq_route_assignments_org_user_route',
  ['organizationId', 'userId', 'routeId'],
  {
    unique: true,
  },
)
export class RouteAssignmentEntity extends BaseEntity {
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

  @Column({ type: 'jsonb', default: [] })
  weekdays: number[];
}
