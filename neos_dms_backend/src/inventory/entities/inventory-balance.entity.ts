import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { ItemEntity } from '../../trading/entities/item.entity';
import { InventoryLocationEntity } from './inventory-location.entity';

/**
 * Materialized on-hand quantity per org × location × item, always in the
 * item's base uom. Rows are locked with `SELECT ... FOR UPDATE` while posting
 * a transaction so concurrent moves never overdraw.
 */
@Entity('inventory_balances')
@Index(
  'uq_inventory_balances_org_loc_item',
  ['organizationId', 'locationId', 'itemId'],
  {
    unique: true,
    where: '"deletedAt" IS NULL',
  },
)
export class InventoryBalanceEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => InventoryLocationEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'location_id' })
  location: InventoryLocationEntity;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @ManyToOne(() => ItemEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_id' })
  item: ItemEntity;

  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  quantity: string;

  /** Moving-average unit cost in the base currency (decision 42). */
  @Column({
    name: 'avg_cost',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  avgCost: string;
}
