import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';

@Entity('transaction_types')
export class TransactionTypeEntity extends BaseEntity {
  /** null = global/system transaction type. */
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity | null;

  @Column({ type: 'varchar' })
  code: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  nature: string;

  @Column({ name: 'is_cross_border', type: 'boolean', default: false })
  isCrossBorder: boolean;

  @Column({ name: 'affects_inventory', type: 'boolean', default: false })
  affectsInventory: boolean;

  @Column({ name: 'affects_tax', type: 'boolean', default: true })
  affectsTax: boolean;

  @Column({ name: 'is_system', type: 'boolean', default: true })
  isSystem: boolean;
}
