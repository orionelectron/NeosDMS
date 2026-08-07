import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';

@Entity('uoms')
@Index('uq_uoms_org_short_name', ['organizationId', 'shortName'], {
  unique: true,
})
export class UomEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ name: 'short_name', type: 'varchar' })
  shortName: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
