import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { InventoryTransactionType } from '../inventory.constants';
import { InventoryLocationEntity } from './inventory-location.entity';
import { InventoryTransactionLineEntity } from './inventory-transaction-line.entity';

@Entity('inventory_transactions')
@Index('idx_inventory_txns_org_location', ['organizationId', 'locationId'])
@Index('idx_inventory_txns_org_type', ['organizationId', 'transactionType'])
@Index(
  'uq_inventory_txns_org_type_number',
  ['organizationId', 'transactionType', 'transactionNumber'],
  {
    unique: true,
  },
)
@Check(
  'chk_inventory_txns_type',
  "transaction_type IN ('opening_stock','stock_adjustment','stock_transfer','sales_invoice','purchase_receipt')",
)
@Check('chk_inventory_txns_status', "status IN ('POSTED')")
@Check(
  'chk_inventory_txns_transfer',
  "(transaction_type <> 'stock_transfer') OR (to_location_id IS NOT NULL AND to_location_id <> location_id)",
)
@Check(
  'chk_inventory_txns_no_target',
  "(transaction_type = 'stock_transfer') OR (to_location_id IS NULL)",
)
export class InventoryTransactionEntity extends BaseEntity {
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

  @Column({ name: 'to_location_id', type: 'uuid', nullable: true })
  toLocationId: string | null;

  @ManyToOne(() => InventoryLocationEntity, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'to_location_id' })
  toLocation: InventoryLocationEntity | null;

  @Column({ name: 'transaction_number', type: 'varchar' })
  transactionNumber: string;

  @Column({ name: 'transaction_type', type: 'varchar' })
  transactionType: InventoryTransactionType;

  /** Source document type once wired (e.g. sales_invoice, purchase_bill). */
  @Column({ name: 'reference_type', type: 'varchar', nullable: true })
  referenceType: string | null;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ type: 'varchar', default: 'POSTED' })
  status: 'POSTED';

  @Column({ name: 'bs_date', type: 'varchar' })
  bsDate: string;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'now()' })
  occurredAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => InventoryTransactionLineEntity, (line) => line.transaction)
  lines: InventoryTransactionLineEntity[];
}
