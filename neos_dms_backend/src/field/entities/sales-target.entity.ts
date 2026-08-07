import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { UserEntity } from '../../iam/entities/user.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { BrandEntity } from '../../trading/entities/brand.entity';
import { ItemCategoryEntity } from '../../trading/entities/item-category.entity';
import type { SalesTargetType } from '../field.constants';

/**
 * A monthly (BS) sales target for a salesperson (decision 35). A target is
 * either a whole-person goal (`PERSONAL`), a per-category goal, or a per-brand
 * goal — the category/brand dimensions let managers set a breakdown on top of
 * the personal target ("Ram sells Rs 500k, of which >= 200k packaged foods").
 * Achievement is computed later from sales invoice lines (Phase 6); this table
 * holds the configuration only. Uniqueness per salesperson/period/dimension is
 * enforced by a functional unique index (COALESCE on the nullable refs).
 */
@Entity('sales_targets')
@Index('idx_sales_targets_org_user_period', [
  'organizationId',
  'userId',
  'bsYear',
  'bsMonth',
])
@Index('idx_sales_targets_org_period', ['organizationId', 'bsYear', 'bsMonth'])
export class SalesTargetEntity extends BaseEntity {
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

  @Column({ name: 'bs_year', type: 'integer' })
  bsYear: number;

  @Column({ name: 'bs_month', type: 'integer' })
  bsMonth: number;

  @Column({ name: 'target_type', type: 'varchar' })
  targetType: SalesTargetType;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => ItemCategoryEntity, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'category_id' })
  category: ItemCategoryEntity | null;

  @Column({ name: 'brand_id', type: 'uuid', nullable: true })
  brandId: string | null;

  @ManyToOne(() => BrandEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'brand_id' })
  brand: BrandEntity | null;

  @Column({
    name: 'amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
  })
  amount: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
