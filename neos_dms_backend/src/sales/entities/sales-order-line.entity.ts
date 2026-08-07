import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { ItemEntity } from '../../trading/entities/item.entity';
import { UomEntity } from '../../trading/entities/uom.entity';
import { SalesOrderEntity } from './sales-order.entity';

@Entity('sales_order_lines')
@Index('uq_sales_order_lines_order_no', ['orderId', 'lineNo'], {
  unique: true,
})
@Index('idx_sales_order_lines_order', ['orderId'])
@Index('idx_sales_order_lines_org_item', ['organizationId', 'itemId'])
@Check('chk_sales_order_lines_qty', 'quantity >= 0')
@Check('chk_sales_order_lines_free_qty', 'free_quantity >= 0')
@Check('chk_sales_order_lines_has_units', 'quantity > 0 OR free_quantity > 0')
@Check('chk_sales_order_lines_base_qty', 'base_quantity > 0')
@Check('chk_sales_order_lines_price', 'unit_price >= 0')
@Check(
  'chk_sales_order_lines_discount',
  'discount_percent >= 0 AND discount_percent <= 100',
)
@Check('chk_sales_order_lines_total', 'line_total >= 0')
@Check(
  'chk_sales_order_lines_invoiced',
  'invoiced_quantity >= 0 AND invoiced_quantity <= quantity',
)
export class SalesOrderLineEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => SalesOrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: SalesOrderEntity;

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

  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity: string;

  /** Free units of the same item — shipped but never billed. */
  @Column({
    name: 'free_quantity',
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: 0,
  })
  freeQuantity: string;

  /** Base-uom quantity of the total shipped (quantity + free_quantity). */
  @Column({ name: 'base_quantity', type: 'decimal', precision: 15, scale: 3 })
  baseQuantity: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 15, scale: 2 })
  unitPrice: string;

  @Column({
    name: 'discount_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  discountPercent: string;

  @Column({ name: 'line_total', type: 'decimal', precision: 15, scale: 2 })
  lineTotal: string;

  /** Billed sell-uom quantity across posted invoices; remainder is billable. */
  @Column({
    name: 'invoiced_quantity',
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: 0,
  })
  invoicedQuantity: string;
}
