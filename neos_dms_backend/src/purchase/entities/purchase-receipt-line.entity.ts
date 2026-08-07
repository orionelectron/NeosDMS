import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { ItemEntity } from '../../trading/entities/item.entity';
import { UomEntity } from '../../trading/entities/uom.entity';
import { PurchaseReceiptEntity } from './purchase-receipt.entity';

@Entity('purchase_receipt_lines')
@Index('uq_purchase_receipt_lines_receipt_no', ['receiptId', 'lineNo'], {
  unique: true,
})
@Index('idx_purchase_receipt_lines_receipt', ['receiptId'])
@Index('idx_purchase_receipt_lines_org_item', ['organizationId', 'itemId'])
@Check('chk_purchase_receipt_lines_qty', 'quantity > 0')
@Check('chk_purchase_receipt_lines_base_qty', 'base_quantity > 0')
@Check('chk_purchase_receipt_lines_cost', 'unit_cost >= 0')
export class PurchaseReceiptLineEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'receipt_id', type: 'uuid' })
  receiptId: string;

  @ManyToOne(() => PurchaseReceiptEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receipt_id' })
  receipt: PurchaseReceiptEntity;

  @Column({ name: 'line_no', type: 'integer' })
  lineNo: number;

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

  /** Received quantity in the entry uom. */
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity: string;

  /** Received quantity converted to the item's base uom. */
  @Column({ name: 'base_quantity', type: 'decimal', precision: 15, scale: 3 })
  baseQuantity: string;

  /** Seeds the later purchase bill (decision 42) — does not reweight stock value. */
  @Column({
    name: 'unit_cost',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  unitCost: string;

  /**
   * Base-unit quantity already claimed by posted purchase bills (decision 40
   * single-move rule). A receipt line bills once — a second bill referencing
   * it is rejected at POST.
   */
  @Column({
    name: 'billed_quantity',
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: 0,
  })
  billedQuantity: string;

  /**
   * Base-unit quantity already reversed by posted purchase returns that were
   * never billed. A later bill may only claim the remaining quantity
   * `base_quantity − billed_quantity − returned_quantity`.
   */
  @Column({
    name: 'returned_quantity',
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: 0,
  })
  returnedQuantity: string;
}
