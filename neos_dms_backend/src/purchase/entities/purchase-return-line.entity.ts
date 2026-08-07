import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { TaxCodeEntity } from '../../accounting/entities/tax-code.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { ItemEntity } from '../../trading/entities/item.entity';
import { UomEntity } from '../../trading/entities/uom.entity';
import { PurchaseBillLineEntity } from './purchase-bill-line.entity';
import { PurchaseReceiptLineEntity } from './purchase-receipt-line.entity';
import { PurchaseReturnEntity } from './purchase-return.entity';

@Entity('purchase_return_lines')
@Index('uq_purchase_return_lines_return_no', ['returnId', 'lineNo'], {
  unique: true,
})
@Index('idx_purchase_return_lines_return', ['returnId'])
@Index('idx_purchase_return_lines_item', ['itemId'])
@Index('idx_purchase_return_lines_source_bill', ['sourcePurchaseBillLineId'])
@Index('idx_purchase_return_lines_source_receipt', [
  'sourcePurchaseReceiptLineId',
])
@Check('chk_purchase_return_lines_qty', 'quantity > 0')
@Check('chk_purchase_return_lines_base_qty', 'base_quantity > 0')
@Check('chk_purchase_return_lines_price', 'unit_price >= 0')
@Check('chk_purchase_return_lines_tax_rate', 'tax_rate >= 0')
@Check('chk_purchase_return_lines_tds_rate', 'tds_rate >= 0')
@Check('chk_purchase_return_lines_tax_amount', 'tax_amount >= 0')
@Check('chk_purchase_return_lines_tds_amount', 'tds_amount >= 0')
@Check('chk_purchase_return_lines_total', 'line_total >= 0')
export class PurchaseReturnLineEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'return_id', type: 'uuid' })
  returnId: string;

  @ManyToOne(() => PurchaseReturnEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'return_id' })
  return: PurchaseReturnEntity;

  @Column({ name: 'line_no', type: 'integer' })
  lineNo: number;

  /**
   * When set, the return reverses a posted bill line — reverse journal
   * (DR AP 2101 + DR TDS 2103 / CR Inventory 1104 + CR VAT 1105) and a
   * stock-out `purchase_return` transaction at the bill's value.
   */
  @Column({
    name: 'source_purchase_bill_line_id',
    type: 'uuid',
    nullable: true,
  })
  sourcePurchaseBillLineId: string | null;

  @ManyToOne(() => PurchaseBillLineEntity, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'source_purchase_bill_line_id' })
  sourceBillLine: PurchaseBillLineEntity | null;

  /**
   * When set, the return reverses a never-billed posted GRN line — stock-out
   * only, no journal (decision 41); the balance quantity drops while the
   * pool value stays, so avg_cost rises.
   */
  @Column({
    name: 'source_purchase_receipt_line_id',
    type: 'uuid',
    nullable: true,
  })
  sourcePurchaseReceiptLineId: string | null;

  @ManyToOne(() => PurchaseReceiptLineEntity, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'source_purchase_receipt_line_id' })
  sourceReceiptLine: PurchaseReceiptLineEntity | null;

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

  /** Returned quantity in the entry uom. */
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity: string;

  /** Returned quantity converted to the item's base uom. */
  @Column({ name: 'base_quantity', type: 'decimal', precision: 15, scale: 3 })
  baseQuantity: string;

  /**
   * Bill-sourced: the source bill line's unit price (stock leaves at the
   * original purchase cost — a debit note reverses the original transaction).
   * GRN-sourced: the receipt line's unit_cost (informational only; value 0).
   */
  @Column({ name: 'unit_price', type: 'decimal', precision: 15, scale: 2 })
  unitPrice: string;

  /** quantity × unit_price — the Inventory 1104 value reversed. */
  @Column({ name: 'gross_amount', type: 'decimal', precision: 15, scale: 2 })
  grossAmount: string;

  @Column({ name: 'tax_code_id', type: 'uuid', nullable: true })
  taxCodeId: string | null;

  @ManyToOne(() => TaxCodeEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tax_code_id' })
  taxCode: TaxCodeEntity | null;

  @Column({ name: 'ird_category', type: 'varchar', nullable: true })
  irdCategory: string | null;

  /** Input VAT rate snapshot from the source bill line. */
  @Column({ name: 'tax_rate', type: 'decimal', precision: 7, scale: 4 })
  taxRate: string;

  /** Base the reversed VAT/TDS is charged on (the return's gross). */
  @Column({ name: 'taxable_amount', type: 'decimal', precision: 15, scale: 2 })
  taxableAmount: string;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 15, scale: 2 })
  taxAmount: string;

  @Column({ name: 'tds_tax_code_id', type: 'uuid', nullable: true })
  tdsTaxCodeId: string | null;

  @ManyToOne(() => TaxCodeEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tds_tax_code_id' })
  tdsTaxCode: TaxCodeEntity | null;

  /** TDS withholding rate snapshot from the source bill line. */
  @Column({ name: 'tds_rate', type: 'decimal', precision: 7, scale: 4 })
  tdsRate: string;

  /** taxable_amount × tds_rate — reversed on TDS Payable 2103. */
  @Column({ name: 'tds_amount', type: 'decimal', precision: 15, scale: 2 })
  tdsAmount: string;

  /** taxable_amount + tax_amount. */
  @Column({ name: 'line_total', type: 'decimal', precision: 15, scale: 2 })
  lineTotal: string;
}
