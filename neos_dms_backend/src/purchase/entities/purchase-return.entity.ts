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
import { JournalEntryEntity } from '../../accounting/entities/journal-entry.entity';
import { PartyEntity } from '../../accounting/entities/party.entity';
import { InventoryLocationEntity } from '../../inventory/entities/inventory-location.entity';
import { InventoryTransactionEntity } from '../../inventory/entities/inventory-transaction.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { BranchEntity } from '../../tenancy/entities/branch.entity';
import type { PurchaseReturnStatus } from '../purchase.constants';
import { PurchaseReturnLineEntity } from './purchase-return-line.entity';

@Entity('purchase_returns')
@Index('uq_purchase_returns_org_number', ['organizationId', 'returnNumber'], {
  unique: true,
})
@Index('idx_purchase_returns_org_status', ['organizationId', 'status'])
@Index('idx_purchase_returns_org_party', ['organizationId', 'partyId'])
@Index('idx_purchase_returns_org_location', [
  'organizationId',
  'inventoryLocationId',
])
@Index('idx_purchase_returns_org_date', ['organizationId', 'returnDate'])
@Check(
  'chk_purchase_returns_status',
  "status IN ('DRAFT','POSTED','CANCELLED')",
)
@Check('chk_purchase_returns_total', 'total >= 0')
export class PurchaseReturnEntity extends BaseEntity {
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

  /** Debit note number (`DN-…`); reserved at POST, drafts stay null. */
  @Column({ name: 'return_number', type: 'varchar', nullable: true })
  returnNumber: string | null;

  @Column({ name: 'fiscal_year_id', type: 'uuid', nullable: true })
  fiscalYearId: string | null;

  @ManyToOne(() => FiscalYearEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'fiscal_year_id' })
  fiscalYear: FiscalYearEntity | null;

  /** The supplier being debited for the returned goods. */
  @Column({ name: 'party_id', type: 'uuid' })
  partyId: string;

  @ManyToOne(() => PartyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'party_id' })
  party: PartyEntity;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status: PurchaseReturnStatus;

  @Column({ name: 'return_date', type: 'date', nullable: true })
  returnDate: string | null;

  @Column({ name: 'return_date_bs', type: 'varchar', nullable: true })
  returnDateBs: string | null;

  /**
   * Godown the returned goods leave from. Required at POST and must match
   * every source line's document location (bill or receipt).
   */
  @Column({ name: 'inventory_location_id', type: 'uuid', nullable: true })
  inventoryLocationId: string | null;

  @ManyToOne(() => InventoryLocationEntity, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'inventory_location_id' })
  inventoryLocation: InventoryLocationEntity | null;

  /** Sum of taxable (VAT-charged) return bases (bill-sourced lines only). */
  @Column({ name: 'taxable_total', type: 'decimal', precision: 15, scale: 2 })
  taxableTotal: string;

  /** Sum of exempt/zero-rated return bases (bill-sourced lines only). */
  @Column({
    name: 'non_taxable_total',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  nonTaxableTotal: string;

  /** Sum of bill-sourced line gross amounts. */
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  subtotal: string;

  /** Always 0 in MVP — returns do not carry discounts (credit/debit note is full-price). */
  @Column({ name: 'discount_total', type: 'decimal', precision: 15, scale: 2 })
  discountTotal: string;

  /** Input VAT reversed (CR VAT Receivable 1105). */
  @Column({ name: 'tax_total', type: 'decimal', precision: 15, scale: 2 })
  taxTotal: string;

  /** Sum of per-line TDS reversed (DR TDS Payable 2103). */
  @Column({ name: 'tds_total', type: 'decimal', precision: 15, scale: 2 })
  tdsTotal: string;

  /** Supplier invoice total = subtotal + tax_total; AP reversal = total − tds_total. */
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  total: string;

  @Column({ name: 'inventory_transaction_id', type: 'uuid', nullable: true })
  inventoryTransactionId: string | null;

  @ManyToOne(() => InventoryTransactionEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'inventory_transaction_id' })
  inventoryTransaction: InventoryTransactionEntity | null;

  @Column({ name: 'journal_entry_id', type: 'uuid', nullable: true })
  journalEntryId: string | null;

  @ManyToOne(() => JournalEntryEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'journal_entry_id' })
  journalEntry: JournalEntryEntity | null;

  @Column({ name: 'return_reason', type: 'text', nullable: true })
  returnReason: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => PurchaseReturnLineEntity, (line) => line.return)
  lines: PurchaseReturnLineEntity[];
}
