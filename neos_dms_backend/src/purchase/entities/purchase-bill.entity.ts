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
import type { PurchaseBillStatus } from '../purchase.constants';
import { PurchaseBillLineEntity } from './purchase-bill-line.entity';

@Entity('purchase_bills')
@Index('uq_purchase_bills_org_number', ['organizationId', 'billNumber'], {
  unique: true,
})
@Index('idx_purchase_bills_org_status', ['organizationId', 'status'])
@Index('idx_purchase_bills_org_party', ['organizationId', 'partyId'])
@Index('idx_purchase_bills_org_location', [
  'organizationId',
  'inventoryLocationId',
])
@Index('idx_purchase_bills_org_date', ['organizationId', 'billDate'])
@Check('chk_purchase_bills_status', "status IN ('DRAFT','POSTED','CANCELLED')")
@Check('chk_purchase_bills_total', 'total >= 0')
export class PurchaseBillEntity extends BaseEntity {
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
  @Column({ name: 'bill_number', type: 'varchar', nullable: true })
  billNumber: string | null;

  /** The supplier's own invoice number, captured for reconciliation. */
  @Column({ name: 'vendor_bill_no', type: 'varchar', nullable: true })
  vendorBillNo: string | null;

  @Column({ name: 'fiscal_year_id', type: 'uuid', nullable: true })
  fiscalYearId: string | null;

  @ManyToOne(() => FiscalYearEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'fiscal_year_id' })
  fiscalYear: FiscalYearEntity | null;

  @Column({ name: 'party_id', type: 'uuid' })
  partyId: string;

  @ManyToOne(() => PartyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'party_id' })
  party: PartyEntity;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status: PurchaseBillStatus;

  @Column({ name: 'bill_date', type: 'date', nullable: true })
  billDate: string | null;

  @Column({ name: 'bill_date_bs', type: 'varchar', nullable: true })
  billDateBs: string | null;

  /**
   * Where value lands / already landed. Required at POST: direct lines are
   * stocked in here, and every sourced receipt line must belong to a receipt
   * at this same location (single-move rule).
   */
  @Column({ name: 'inventory_location_id', type: 'uuid', nullable: true })
  inventoryLocationId: string | null;

  @ManyToOne(() => InventoryLocationEntity, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'inventory_location_id' })
  inventoryLocation: InventoryLocationEntity | null;

  /** Sum of taxable (VAT-charged) line bases after discounts. */
  @Column({ name: 'taxable_total', type: 'decimal', precision: 15, scale: 2 })
  taxableTotal: string;

  /** Sum of exempt/zero-rated line bases after discounts. */
  @Column({
    name: 'non_taxable_total',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  nonTaxableTotal: string;

  /** Sum of line gross amounts net of the header discount (pre-tax). */
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  subtotal: string;

  /** Header-level discount credited to Discounts Received 5104. */
  @Column({ name: 'discount_total', type: 'decimal', precision: 15, scale: 2 })
  discountTotal: string;

  /** Input VAT (DR VAT Receivable 1105). */
  @Column({ name: 'tax_total', type: 'decimal', precision: 15, scale: 2 })
  taxTotal: string;

  /** Sum of per-line TDS withheld (CR TDS Payable 2103). */
  @Column({ name: 'tds_total', type: 'decimal', precision: 15, scale: 2 })
  tdsTotal: string;

  /** Supplier invoice total = subtotal + tax_total; AP = total − tds_total. */
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

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => PurchaseBillLineEntity, (line) => line.bill)
  lines: PurchaseBillLineEntity[];
}
