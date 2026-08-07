import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { ItemEntity } from '../../trading/entities/item.entity';
import { UomEntity } from '../../trading/entities/uom.entity';
import type { InventoryDirection } from '../inventory.constants';
import { InventoryTransactionEntity } from './inventory-transaction.entity';

@Entity('inventory_transaction_lines')
@Index('idx_inventory_lines_txn', ['transactionId'])
@Index('idx_inventory_lines_org_item', ['organizationId', 'itemId'])
@Check('chk_inventory_lines_qty', '"quantity" > 0')
@Check('chk_inventory_lines_direction', "direction IN ('IN','OUT')")
export class InventoryTransactionLineEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId: string;

  @ManyToOne(() => InventoryTransactionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transaction_id' })
  transaction: InventoryTransactionEntity;

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

  @Column({ type: 'varchar' })
  direction: InventoryDirection;

  /** Quantity in the stated uom; converted to the item's base uom for balances. */
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity: string;

  @Column({
    name: 'unit_cost',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  unitCost: string;
}
