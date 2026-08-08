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
import type { SalesReturnStatus } from '../sales.constants';
import { SalesReturnLineEntity } from './sales-return-line.entity';

/**
 * Sales return — the credit note. Mirrors the purchase debit note: lines
 * source a posted sales invoice line and re-enter the returned goods at the
 * invoice's snapshotted `cogs_unit_cost`, so the stock-in transaction is the
 * exact mirror of the invoice's stock-out. POST reserves the `CN-` number and
 * posts the reverse Sales/VAT/AR journal plus the Inventory/COGS restoration,
 * then stamps `returned_quantity` on the source lines.
 */
@Entity('sales_returns')
@Index('uq_sales_returns_org_number', ['organizationId', 'returnNumber'], {
  unique: true,
})
@Index('idx_sales_returns_org_status', ['organizationId', 'status'])
@Index('idx_sales_returns_org_party', ['organizationId', 'partyId'])
@Index('idx_sales_returns_org_location', [
  'organizationId',
  'inventoryLocationId',
])
@Index('idx_sales_returns_org_date', ['organizationId', 'returnDate'])
@Check('chk_sales_returns_status', "status IN ('DRAFT','POSTED','CANCELLED')")
@Check('chk_sales_returns_total', 'total >= 0')
export class SalesReturnEntity extends BaseEntity {
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

  /** Credit note number (`CN-…`); reserved at POST, drafts stay null. */
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

  /** The customer receiving the credit. */
  @Column({ name: 'party_id', type: 'uuid' })
  partyId: string;

  @ManyToOne(() => PartyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'party_id' })
  party: PartyEntity;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status: SalesReturnStatus;

  @Column({ name: 'return_date', type: 'date', nullable: true })
  returnDate: string | null;

  @Column({ name: 'return_date_bs', type: 'varchar', nullable: true })
  returnDateBs: string | null;

  /**
   * Godown the returned goods re-enter. Required at POST; a customer return
   * is not tied to an invoice location (invoices do not store one), so any
   * active location is accepted.
   */
  @Column({ name: 'inventory_location_id', type: 'uuid', nullable: true })
  inventoryLocationId: string | null;

  @ManyToOne(() => InventoryLocationEntity, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'inventory_location_id' })
  inventoryLocation: InventoryLocationEntity | null;

  /** Sum of taxable (VAT-charged) return bases. */
  @Column({ name: 'taxable_total', type: 'decimal', precision: 15, scale: 2 })
  taxableTotal: string;

  /** Sum of exempt/zero-rated return bases. */
  @Column({
    name: 'non_taxable_total',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  nonTaxableTotal: string;

  /** Sum of line gross amounts (full-price reversal). */
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  subtotal: string;

  /**
   * Always 0 in MVP — returns do not carry discounts (credit note is
   * full-price; the invoice's header discount stays recognized).
   */
  @Column({ name: 'discount_total', type: 'decimal', precision: 15, scale: 2 })
  discountTotal: string;

  /** Output VAT reversed (DR VAT Payable 2111). */
  @Column({ name: 'tax_total', type: 'decimal', precision: 15, scale: 2 })
  taxTotal: string;

  /** Σ base_quantity × cogs_unit_cost — the Inventory 1104 value restored. */
  @Column({ name: 'cogs_total', type: 'decimal', precision: 15, scale: 2 })
  cogsTotal: string;

  /** Customer invoice total reversed = subtotal + tax_total (CR AR). */
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

  @OneToMany(() => SalesReturnLineEntity, (line) => line.return)
  lines: SalesReturnLineEntity[];

  /** Stamped by dispatch `complete` for auto-drafted shortfall credit notes. */
  @Column({ name: 'dispatch_stop_id', type: 'uuid', nullable: true })
  dispatchStopId: string | null;
}
