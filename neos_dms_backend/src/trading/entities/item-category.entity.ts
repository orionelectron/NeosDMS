import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';

@Entity('item_categories')
@Index('uq_item_categories_org_code', ['organizationId', 'code'], {
  unique: true,
})
@Index('idx_item_categories_org_parent', ['organizationId', 'parentCategoryId'])
export class ItemCategoryEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'parent_category_id', type: 'uuid', nullable: true })
  parentCategoryId: string | null;

  @ManyToOne(() => ItemCategoryEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'parent_category_id' })
  parentCategory: ItemCategoryEntity | null;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  code: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
