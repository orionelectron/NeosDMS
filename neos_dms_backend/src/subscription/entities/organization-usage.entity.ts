import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';

@Entity('organization_usages')
@Index(
  'uq_organization_usages_org_resource',
  ['organizationId', 'resourceCode'],
  {
    unique: true,
  },
)
@Check('chk_organization_usages_current_usage', 'current_usage >= 0')
export class OrganizationUsageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ type: 'varchar', name: 'resource_code' })
  resourceCode: string;

  @Column({ type: 'int', name: 'current_usage', default: 0 })
  currentUsage: number;

  @Column({ name: 'last_reset_at', type: 'timestamptz', nullable: true })
  lastResetAt: Date | null;
}
