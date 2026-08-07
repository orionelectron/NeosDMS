import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { OutletEntity } from './outlet.entity';
import { RouteEntity } from './route.entity';

/** Junction: an outlet can sit on multiple routes, a route holds many outlets. */
@Entity('outlet_routes')
@Index(
  'uq_outlet_routes_org_outlet_route',
  ['organizationId', 'outletId', 'routeId'],
  {
    unique: true,
  },
)
export class OutletRouteEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'outlet_id', type: 'uuid' })
  outletId: string;

  @ManyToOne(() => OutletEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet: OutletEntity;

  @Column({ name: 'route_id', type: 'uuid' })
  routeId: string;

  @ManyToOne(() => RouteEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route: RouteEntity;
}
