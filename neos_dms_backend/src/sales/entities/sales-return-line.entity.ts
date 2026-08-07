import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { TaxCodeEntity } from '../../accounting/entities/tax-code.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { ItemEntity } from '../../trading/entities/item.entity';
import { UomEntity } from '../../trading/entities/uom.entity';
import { SalesInvoiceLineEntity } from './sales-invoice-line.entity';
import { SalesReturnEntity } from './sales-return.entity';

/**
 * A returned invoice line — the exact mirror of the sales stock-out (decision
 * 42). The unit price, tax snapshot and COGS unit cost all come from the
 * source invoice line, so the credit note reverses the original sale: the
 * stock re-enters at the invoiced cost and the COGS reweight unwinds.
 */
@Entity('sales_return_lines')
@Index('uq_sales_return_lines_return_no', ['returnId', 'lineNo'], {
  unique: true,
})
@Index('idx_sales_return_lines_return', ['returnId'])
@Index('idx_sales_return_lines_item', ['itemId'])
@Index('idx_sales_return_lines_source_invoice', ['sourceSalesInvoiceLineId'])
@Check('chk_sales_return_lines_qty', 'quantity > 0')
@Check('chk_sales_return_lines_base_qty', 'base_quantity > 0')
@Check('chk_sales_return_lines_price', 'unit_price >= 0')
@Check('chk_sales_return_lines_tax_rate', 'tax_rate >= 0')
@Check('chk_sales_return_lines_tax_amount', 'tax_amount >= 0')
@Check('chk_sales_return_lines_total', 'line_total >= 0')
@Check('chk_sales_return_lines_cogs', 'cogs_unit_cost >= 0')
export class SalesReturnLineEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'return_id', type: 'uuid' })
  returnId: string;

  @ManyToOne(() => SalesReturnEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'return_id' })
  return: SalesReturnEntity;

  @Column({ name: 'line_no', type: 'integer' })
  lineNo: number;

  /**
   * The posted invoice line being reversed. The return reverses the invoice's
   * Sales/VAT journal and re-enters stock at the line's `cogs_unit_cost`.
   */
  @Column({ name: 'source_sales_invoice_line_id', type: 'uuid' })
  sourceSalesInvoiceLineId: string;

  @ManyToOne(() => SalesInvoiceLineEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'source_sales_invoice_line_id' })
  sourceInvoiceLine: SalesInvoiceLineEntity;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @ManyToOne(() => ItemEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_id' })
  item: ItemEntity;

  @Column({ name: 'uom_id', type: 'uuid' })
  uomId: string;

  @ManyToOne(() => UomEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uom_id' })
  uom: UomEntity;

  /** Returned quantity in the source line's uom. */
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity: string;

  /** Returned quantity converted to the item's base uom. */
  @Column({ name: 'base_quantity', type: 'decimal', precision: 15, scale: 3 })
  baseQuantity: string;

  /**
   * The source invoice line's unit price — the credit reverses the original
   * transaction (full-price, decision 43).
   */
  @Column({ name: 'unit_price', type: 'decimal', precision: 15, scale: 2 })
  unitPrice: string;

  /** quantity × unit_price — the Sales 4000 revenue reversed. */
  @Column({ name: 'gross_amount', type: 'decimal', precision: 15, scale: 2 })
  grossAmount: string;

  @Column({ name: 'tax_code_id', type: 'uuid', nullable: true })
  taxCodeId: string | null;

  @ManyToOne(() => TaxCodeEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tax_code_id' })
  taxCode: TaxCodeEntity | null;

  @Column({ name: 'ird_category', type: 'varchar', nullable: true })
  irdCategory: string | null;

  /** Output VAT rate snapshot from the source invoice line. */
  @Column({ name: 'tax_rate', type: 'decimal', precision: 7, scale: 4 })
  taxRate: string;

  /** The gross — base the reversed VAT is charged on. */
  @Column({ name: 'taxable_amount', type: 'decimal', precision: 15, scale: 2 })
  taxableAmount: string;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 15, scale: 2 })
  taxAmount: string;

  /** taxable_amount + tax_amount. */
  @Column({ name: 'line_total', type: 'decimal', precision: 15, scale: 2 })
  lineTotal: string;

  /**
   * Moving-average unit cost snapshot from the source invoice line — the
   * stock re-enters at this cost (the exact mirror of the stock-out).
   */
  @Column({
    name: 'cogs_unit_cost',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  cogsUnitCost: string;
}
