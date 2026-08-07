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
import { FiscalYearEntity } from '../../accounting/entities/fiscal-year.entity';
import { PartyEntity } from '../../accounting/entities/party.entity';
import { InventoryLocationEntity } from '../../inventory/entities/inventory-location.entity';
import { InventoryTransactionEntity } from '../../inventory/entities/inventory-transaction.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { BranchEntity } from '../../tenancy/entities/branch.entity';
import type { PurchaseReceiptStatus } from '../purchase.constants';
import { PurchaseReceiptLineEntity } from './purchase-receipt-line.entity';

@Entity('purchase_receipts')
@Index('uq_purchase_receipts_org_number', ['organizationId', 'receiptNumber'], {
  unique: true,
})
@Index('idx_purchase_receipts_org_status', ['organizationId', 'status'])
@Index('idx_purchase_receipts_org_party', ['organizationId', 'partyId'])
@Index('idx_purchase_receipts_org_location', [
  'organizationId',
  'inventoryLocationId',
])
@Index('idx_purchase_receipts_org_date', ['organizationId', 'receiptDate'])
@Check(
  'chk_purchase_receipts_status',
  "status IN ('DRAFT','POSTED','CANCELLED')",
)
export class PurchaseReceiptEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @ManyToOne(() => BranchEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: BranchEntity | null;

  /** Assigned at POST via document_sequences; drafts keep null. */
  @Column({ name: 'receipt_number', type: 'varchar', nullable: true })
  receiptNumber: string | null;

  @Column({ name: 'party_id', type: 'uuid' })
  partyId: string;

  @ManyToOne(() => PartyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'party_id' })
  party: PartyEntity;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status: PurchaseReceiptStatus;

  @Column({ name: 'receipt_date', type: 'date', nullable: true })
  receiptDate: string | null;

  @Column({ name: 'receipt_date_bs', type: 'varchar', nullable: true })
  receiptDateBs: string | null;

  @Column({ name: 'fiscal_year_id', type: 'uuid', nullable: true })
  fiscalYearId: string | null;

  @ManyToOne(() => FiscalYearEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'fiscal_year_id' })
  fiscalYear: FiscalYearEntity | null;

  /** The godown the received goods land in (chosen at capture). */
  @Column({ name: 'inventory_location_id', type: 'uuid' })
  inventoryLocationId: string;

  @ManyToOne(() => InventoryLocationEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'inventory_location_id' })
  inventoryLocation: InventoryLocationEntity;

  @Column({ name: 'inventory_transaction_id', type: 'uuid', nullable: true })
  inventoryTransactionId: string | null;

  @ManyToOne(() => InventoryTransactionEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'inventory_transaction_id' })
  inventoryTransaction: InventoryTransactionEntity | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => PurchaseReceiptLineEntity, (line) => line.receipt)
  lines: PurchaseReceiptLineEntity[];
}
