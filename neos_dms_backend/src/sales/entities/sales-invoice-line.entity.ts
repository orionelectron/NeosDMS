import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { TaxCodeEntity } from '../../accounting/entities/tax-code.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { ItemEntity } from '../../trading/entities/item.entity';
import { UomEntity } from '../../trading/entities/uom.entity';
import { SalesInvoiceEntity } from './sales-invoice.entity';
import { SalesOrderLineEntity } from './sales-order-line.entity';

@Entity('sales_invoice_lines')
@Index('uq_sales_invoice_lines_invoice_no', ['invoiceId', 'lineNo'], {
  unique: true,
})
@Index('idx_sales_invoice_lines_invoice', ['invoiceId'])
@Index('idx_sales_invoice_lines_item', ['itemId'])
@Index('idx_sales_invoice_lines_source', ['sourceSalesOrderLineId'])
@Check('chk_sales_invoice_lines_qty', 'quantity >= 0')
@Check('chk_sales_invoice_lines_free_qty', 'free_quantity >= 0')
@Check('chk_sales_invoice_lines_has_units', 'quantity > 0 OR free_quantity > 0')
@Check('chk_sales_invoice_lines_base_qty', 'base_quantity > 0')
@Check('chk_sales_invoice_lines_price', 'unit_price >= 0')
@Check(
  'chk_sales_invoice_lines_discount',
  'discount_percent >= 0 AND discount_percent <= 100',
)
@Check('chk_sales_invoice_lines_total', 'line_total >= 0')
export class SalesInvoiceLineEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => SalesInvoiceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: SalesInvoiceEntity;

  @Column({ name: 'line_no', type: 'integer' })
  lineNo: number;

  /** The order line this invoice line bills against (partial allowed). */
  @Column({ name: 'source_sales_order_line_id', type: 'uuid' })
  sourceSalesOrderLineId: string;

  @ManyToOne(() => SalesOrderLineEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'source_sales_order_line_id' })
  sourceOrderLine: SalesOrderLineEntity;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @ManyToOne(() => ItemEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_id' })
  item: ItemEntity;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'uom_id', type: 'uuid' })
  uomId: string;

  @ManyToOne(() => UomEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uom_id' })
  uom: UomEntity;

  /** Billed quantity in the sell uom. */
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity: string;

  /** Free units shipped with this line — never billed. */
  @Column({
    name: 'free_quantity',
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: 0,
  })
  freeQuantity: string;

  /** Shipped total (quantity + free) converted to the item's base uom. */
  @Column({ name: 'base_quantity', type: 'decimal', precision: 15, scale: 3 })
  baseQuantity: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 15, scale: 2 })
  unitPrice: string;

  @Column({ name: 'is_tax_inclusive', type: 'boolean', default: false })
  isTaxInclusive: boolean;

  /** (quantity + free) × unit_price — before any discount. */
  @Column({ name: 'gross_amount', type: 'decimal', precision: 15, scale: 2 })
  grossAmount: string;

  @Column({
    name: 'discount_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  discountPercent: string;

  /** Per-line percent discount in NPR (gross × percent). */
  @Column({ name: 'discount_amount', type: 'decimal', precision: 15, scale: 2 })
  discountAmount: string;

  @Column({ name: 'tax_code_id', type: 'uuid', nullable: true })
  taxCodeId: string | null;

  @ManyToOne(() => TaxCodeEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tax_code_id' })
  taxCode: TaxCodeEntity | null;

  @Column({ name: 'ird_category', type: 'varchar', nullable: true })
  irdCategory: string | null;

  /** Tax rate snapshot — a rate change never alters a posted bill. */
  @Column({ name: 'tax_rate', type: 'decimal', precision: 7, scale: 4 })
  taxRate: string;

  /** Billed amount the tax is charged on (after the header discount share). */
  @Column({ name: 'taxable_amount', type: 'decimal', precision: 15, scale: 2 })
  taxableAmount: string;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 15, scale: 2 })
  taxAmount: string;

  /** Final billed line amount including tax. */
  @Column({ name: 'line_total', type: 'decimal', precision: 15, scale: 2 })
  lineTotal: string;

  /** Moving-average unit cost snapshotted at POST (decision 42) — COGS basis. */
  @Column({
    name: 'cogs_unit_cost',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  cogsUnitCost: string;
}
