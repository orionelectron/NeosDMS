import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';

@Entity('brands')
@Index('uq_brands_org_name', ['organizationId', 'name'], { unique: true })
export class BrandEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
