import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { TaxCodeEntity } from '../../accounting/entities/tax-code.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { ItemEntity } from '../../trading/entities/item.entity';
import { UomEntity } from '../../trading/entities/uom.entity';
import { PurchaseBillEntity } from './purchase-bill.entity';
import { PurchaseReceiptLineEntity } from './purchase-receipt-line.entity';

@Entity('purchase_bill_lines')
@Index('uq_purchase_bill_lines_bill_no', ['billId', 'lineNo'], {
  unique: true,
})
@Index('idx_purchase_bill_lines_bill', ['billId'])
@Index('idx_purchase_bill_lines_item', ['itemId'])
@Index('idx_purchase_bill_lines_source', ['sourcePurchaseReceiptLineId'])
@Check('chk_purchase_bill_lines_qty', 'quantity > 0')
@Check('chk_purchase_bill_lines_base_qty', 'base_quantity > 0')
@Check('chk_purchase_bill_lines_price', 'unit_price >= 0')
@Check('chk_purchase_bill_lines_tax_rate', 'tax_rate >= 0')
@Check('chk_purchase_bill_lines_tds_rate', 'tds_rate >= 0')
@Check('chk_purchase_bill_lines_tax_amount', 'tax_amount >= 0')
@Check('chk_purchase_bill_lines_tds_amount', 'tds_amount >= 0')
@Check('chk_purchase_bill_lines_total', 'line_total >= 0')
export class PurchaseBillLineEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'bill_id', type: 'uuid' })
  billId: string;

  @ManyToOne(() => PurchaseBillEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bill_id' })
  bill: PurchaseBillEntity;

  @Column({ name: 'line_no', type: 'integer' })
  lineNo: number;

  /**
   * Null for a direct line (stock-in on this bill). When set, the goods are
   * already on hand from the posted GRN — the bill only recognizes value
   * (journal-only, single-move rule).
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

  /** Billed quantity in the entry uom. */
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity: string;

  /** Billed quantity converted to the item's base uom. */
  @Column({ name: 'base_quantity', type: 'decimal', precision: 15, scale: 3 })
  baseQuantity: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 15, scale: 2 })
  unitPrice: string;

  /** quantity × unit_price — before any discount. */
  @Column({ name: 'gross_amount', type: 'decimal', precision: 15, scale: 2 })
  grossAmount: string;

  @Column({ name: 'tax_code_id', type: 'uuid', nullable: true })
  taxCodeId: string | null;

  @ManyToOne(() => TaxCodeEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tax_code_id' })
  taxCode: TaxCodeEntity | null;

  @Column({ name: 'ird_category', type: 'varchar', nullable: true })
  irdCategory: string | null;

  /** Input VAT rate snapshot — a rate change never alters a posted bill. */
  @Column({ name: 'tax_rate', type: 'decimal', precision: 7, scale: 4 })
  taxRate: string;

  /** Billed amount the taxes are charged on (after the header discount share). */
  @Column({ name: 'taxable_amount', type: 'decimal', precision: 15, scale: 2 })
  taxableAmount: string;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 15, scale: 2 })
  taxAmount: string;

  @Column({ name: 'tds_tax_code_id', type: 'uuid', nullable: true })
  tdsTaxCodeId: string | null;

  @ManyToOne(() => TaxCodeEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tds_tax_code_id' })
  tdsTaxCode: TaxCodeEntity | null;

  /** TDS withholding rate snapshot (1.5% services, 15% professional, …). */
  @Column({ name: 'tds_rate', type: 'decimal', precision: 7, scale: 4 })
  tdsRate: string;

  /** taxable_amount × tds_rate — credited to TDS Payable, net of AP. */
  @Column({ name: 'tds_amount', type: 'decimal', precision: 15, scale: 2 })
  tdsAmount: string;

  /** taxable_amount + tax_amount — TDS is a payable split, not part of it. */
  @Column({ name: 'line_total', type: 'decimal', precision: 15, scale: 2 })
  lineTotal: string;
}
