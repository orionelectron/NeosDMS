import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { SalesOrderLineEntity } from '../../sales/entities/sales-order-line.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { ItemEntity } from '../../trading/entities/item.entity';
import { UomEntity } from '../../trading/entities/uom.entity';
import { DispatchStopEntity } from './dispatch-stop.entity';

/**
 * Allocated (order line) quantity snapshot plus the delivery actuals. Entry
 * uom quantities are in the order line's sell uom; the base columns are the
 * item's base uom (drives stock-out invoicing and return shortfall drafting).
 */
@Entity('dispatch_stop_lines')
@Index('uq_dispatch_stop_lines_stop_line', ['stopId', 'orderLineId'], {
  unique: true,
})
@Index('idx_dispatch_stop_lines_org_item', ['organizationId', 'itemId'])
@Index('idx_dispatch_stop_lines_order_line', ['orderLineId'])
@Check('chk_dispatch_stop_lines_allocated', 'allocated_quantity >= 0')
@Check(
  'chk_dispatch_stop_lines_delivered',
  'delivered_quantity >= 0 AND delivered_quantity <= allocated_quantity',
)
@Check(
  'chk_dispatch_stop_lines_returned',
  'returned_quantity >= 0 AND returned_quantity <= allocated_quantity',
)
@Check(
  'chk_dispatch_stop_lines_total',
  'delivered_quantity + returned_quantity <= allocated_quantity',
)
export class DispatchStopLineEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'stop_id', type: 'uuid' })
  stopId: string;

  @ManyToOne(() => DispatchStopEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stop_id' })
  stop: DispatchStopEntity;

  @Column({ name: 'order_line_id', type: 'uuid' })
  orderLineId: string;

  @ManyToOne(() => SalesOrderLineEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_line_id' })
  orderLine: SalesOrderLineEntity;

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

  @Column({
    name: 'allocated_quantity',
    type: 'decimal',
    precision: 15,
    scale: 3,
  })
  allocatedQuantity: string;

  @Column({
    name: 'allocated_base_quantity',
    type: 'decimal',
    precision: 15,
    scale: 3,
  })
  allocatedBaseQuantity: string;

  @Column({
    name: 'delivered_quantity',
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: 0,
  })
  deliveredQuantity: string;

  @Column({
    name: 'returned_quantity',
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: 0,
  })
  returnedQuantity: string;

  @Column({
    name: 'delivered_base_quantity',
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: 0,
  })
  deliveredBaseQuantity: string;

  @Column({
    name: 'returned_base_quantity',
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: 0,
  })
  returnedBaseQuantity: string;
}
