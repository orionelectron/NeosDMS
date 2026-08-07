import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { BranchEntity } from '../../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { InventoryLocationType } from '../inventory.constants';

@Entity('inventory_locations')
@Index('uq_inventory_locations_org_code', ['organizationId', 'code'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
@Index('uq_inventory_locations_org_default', ['organizationId'], {
  unique: true,
  where: '"is_default" = true AND "deletedAt" IS NULL',
})
@Check(
  'chk_inventory_locations_type',
  "location_type IN ('GODOWN','VAN','SHOP','WAREHOUSE')",
)
export class InventoryLocationEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @ManyToOne(() => BranchEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: BranchEntity | null;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  code: string;

  @Column({ name: 'location_type', type: 'varchar' })
  locationType: InventoryLocationType;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
