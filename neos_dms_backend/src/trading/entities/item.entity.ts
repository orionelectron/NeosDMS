import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type {
  InventoryTracking,
  ItemType,
  ValuationMethod,
} from '../trading.constants';
import { AccountEntity } from '../../accounting/entities/account.entity';
import { TaxCodeEntity } from '../../accounting/entities/tax-code.entity';
import { BrandEntity } from './brand.entity';
import { ItemCategoryEntity } from './item-category.entity';
import { UomEntity } from './uom.entity';

@Entity('items')
@Index('uq_items_org_code', ['organizationId', 'code'], { unique: true })
@Index('uq_items_org_sku', ['organizationId', 'sku'], { unique: true })
@Index('idx_items_org_parent', ['organizationId', 'parentItemId'])
@Index('idx_items_barcode', ['barcode'])
@Check('chk_items_type', "type IN ('GOODS','SERVICE','RAW','ASSET')")
@Check(
  'chk_items_valuation_method',
  "valuation_method IN ('FIFO','WEIGHTED_AVERAGE')",
)
@Check(
  'chk_items_inventory_tracking',
  "inventory_tracking IN ('NONE','QUANTITY','BATCH','SERIAL')",
)
export class ItemEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  /** NULL = standalone/template; set = variant child (variants land in P1). */
  @Column({ name: 'parent_item_id', type: 'uuid', nullable: true })
  parentItemId: string | null;

  @ManyToOne(() => ItemEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_item_id' })
  parentItem: ItemEntity | null;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  code: string | null;

  @Column({ type: 'varchar', nullable: true })
  sku: string | null;

  @Column({ type: 'varchar', nullable: true })
  barcode: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', default: 'GOODS' })
  type: ItemType;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => ItemCategoryEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: ItemCategoryEntity | null;

  @Column({ name: 'brand_id', type: 'uuid', nullable: true })
  brandId: string | null;

  @ManyToOne(() => BrandEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'brand_id' })
  brand: BrandEntity | null;

  @Column({ name: 'base_uom_id', type: 'uuid' })
  baseUomId: string;

  @ManyToOne(() => UomEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'base_uom_id' })
  baseUom: UomEntity;

  @Column({ name: 'hsn_code', type: 'varchar', nullable: true })
  hsnCode: string | null;

  @Column({ name: 'valuation_method', type: 'varchar', default: 'FIFO' })
  valuationMethod: ValuationMethod;

  @Column({ name: 'tax_code_id', type: 'uuid', nullable: true })
  taxCodeId: string | null;

  @ManyToOne(() => TaxCodeEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tax_code_id' })
  taxCode: TaxCodeEntity | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  mrp: string;

  @Column({
    name: 'rlp',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  rlp: string;

  @Column({
    name: 'standard_cost',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  standardCost: string;

  @Column({ name: 'reorder_level', type: 'integer', default: 0 })
  reorderLevel: number;

  @Column({ name: 'inventory_tracking', type: 'varchar', default: 'QUANTITY' })
  inventoryTracking: InventoryTracking;

  @Column({ name: 'track_expiry', type: 'boolean', default: false })
  trackExpiry: boolean;

  @Column({ name: 'allow_negative_stock', type: 'boolean', default: false })
  allowNegativeStock: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sales_account_id', type: 'uuid', nullable: true })
  salesAccountId: string | null;

  @ManyToOne(() => AccountEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sales_account_id' })
  salesAccount: AccountEntity | null;

  @Column({ name: 'purchase_account_id', type: 'uuid', nullable: true })
  purchaseAccountId: string | null;

  @ManyToOne(() => AccountEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'purchase_account_id' })
  purchaseAccount: AccountEntity | null;

  @Column({ name: 'sales_return_account_id', type: 'uuid', nullable: true })
  salesReturnAccountId: string | null;

  @ManyToOne(() => AccountEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sales_return_account_id' })
  salesReturnAccount: AccountEntity | null;

  @Column({ name: 'purchase_return_account_id', type: 'uuid', nullable: true })
  purchaseReturnAccountId: string | null;

  @ManyToOne(() => AccountEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'purchase_return_account_id' })
  purchaseReturnAccount: AccountEntity | null;
}
