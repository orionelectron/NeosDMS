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
import { FiscalPeriodEntity } from '../../accounting/entities/fiscal-period.entity';
import { FiscalYearEntity } from '../../accounting/entities/fiscal-year.entity';
import { PartyEntity } from '../../accounting/entities/party.entity';
import { JournalEntryEntity } from '../../accounting/entities/journal-entry.entity';
import { InventoryTransactionEntity } from '../../inventory/entities/inventory-transaction.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { BranchEntity } from '../../tenancy/entities/branch.entity';
import { UserEntity } from '../../iam/entities/user.entity';
import type { CbmsPushStatus, SalesInvoiceStatus } from '../sales.constants';
import { SalesOrderEntity } from './sales-order.entity';
import { SalesInvoiceLineEntity } from './sales-invoice-line.entity';

@Entity('sales_invoices')
@Index('uq_sales_invoices_org_number', ['organizationId', 'invoiceNumber'], {
  unique: true,
})
@Index('idx_sales_invoices_org_status', ['organizationId', 'status'])
@Index('idx_sales_invoices_org_party', ['organizationId', 'partyId'])
@Index('idx_sales_invoices_org_order', ['organizationId', 'orderId'])
@Index('idx_sales_invoices_org_salesperson', [
  'organizationId',
  'salespersonId',
])
@Index('idx_sales_invoices_org_date', ['organizationId', 'invoiceDate'])
@Check('chk_sales_invoices_status', "status IN ('DRAFT','POSTED','CANCELLED')")
@Check('chk_sales_invoices_total', 'total >= 0')
@Check(
  'chk_sales_invoices_cbms',
  "cbms_status IN ('NOT_REQUIRED','PENDING','PUSHED','FAILED')",
)
export class SalesInvoiceEntity extends BaseEntity {
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
  @Column({ name: 'invoice_number', type: 'varchar', nullable: true })
  invoiceNumber: string | null;

  @Column({ name: 'fiscal_year_id', type: 'uuid', nullable: true })
  fiscalYearId: string | null;

  @ManyToOne(() => FiscalYearEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'fiscal_year_id' })
  fiscalYear: FiscalYearEntity | null;

  @Column({ name: 'fiscal_period_id', type: 'uuid', nullable: true })
  fiscalPeriodId: string | null;

  @ManyToOne(() => FiscalPeriodEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'fiscal_period_id' })
  fiscalPeriod: FiscalPeriodEntity | null;

  @Column({ name: 'sales_order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => SalesOrderEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sales_order_id' })
  order: SalesOrderEntity;

  @Column({ name: 'party_id', type: 'uuid' })
  partyId: string;

  @ManyToOne(() => PartyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'party_id' })
  party: PartyEntity;

  @Column({ name: 'salesperson_id', type: 'uuid' })
  salespersonId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'salesperson_id' })
  salesperson: UserEntity;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status: SalesInvoiceStatus;

  @Column({ name: 'invoice_date', type: 'date', nullable: true })
  invoiceDate: string | null;

  @Column({ name: 'invoice_date_bs', type: 'varchar', nullable: true })
  invoiceDateBs: string | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ name: 'due_date_bs', type: 'varchar', nullable: true })
  dueDateBs: string | null;

  /** Buyer snapshot at invoice creation (IRD invoice requirements). */
  @Column({ name: 'buyer_name', type: 'varchar', nullable: true })
  buyerName: string | null;

  @Column({ name: 'buyer_address', type: 'varchar', nullable: true })
  buyerAddress: string | null;

  @Column({ name: 'buyer_pan', type: 'varchar', nullable: true })
  buyerPan: string | null;

  @Column({ name: 'buyer_vat', type: 'varchar', nullable: true })
  buyerVat: string | null;

  /** Sum of taxable (VAT-charged) line amounts after discounts. */
  @Column({ name: 'taxable_total', type: 'decimal', precision: 15, scale: 2 })
  taxableTotal: string;

  /** Sum of zero-rated/exempt line amounts after discounts. */
  @Column({
    name: 'non_taxable_total',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  nonTaxableTotal: string;

  /** Sum of line amounts before the header discount (pre-tax). */
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  subtotal: string;

  /** Header-level fixed discount apportioned to this invoice. */
  @Column({ name: 'discount_total', type: 'decimal', precision: 15, scale: 2 })
  discountTotal: string;

  @Column({ name: 'tax_total', type: 'decimal', precision: 15, scale: 2 })
  taxTotal: string;

  @Column({
    name: 'rounding_adjustment',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  roundingAdjustment: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  total: string;

  /** CBMS breakdown columns — populated from the line ird categories. */
  @Column({
    name: 'excisable_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  excisableAmount: string;

  @Column({ name: 'excise_total', type: 'decimal', precision: 15, scale: 2 })
  exciseTotal: string;

  @Column({ name: 'hst_total', type: 'decimal', precision: 15, scale: 2 })
  hstTotal: string;

  @Column({ name: 'esf_total', type: 'decimal', precision: 15, scale: 2 })
  esfTotal: string;

  @Column({ name: 'export_total', type: 'decimal', precision: 15, scale: 2 })
  exportTotal: string;

  /** Derived from customer receipts (Phase 6c) — 0 until then. */
  @Column({ name: 'paid_amount', type: 'decimal', precision: 15, scale: 2 })
  paidAmount: string;

  @Column({ name: 'balance_amount', type: 'decimal', precision: 15, scale: 2 })
  balanceAmount: string;

  @Column({ name: 'print_count', type: 'integer', default: 0 })
  printCount: number;

  @Column({ name: 'first_printed_at', type: 'timestamptz', nullable: true })
  firstPrintedAt: Date | null;

  @Column({ name: 'last_printed_at', type: 'timestamptz', nullable: true })
  lastPrintedAt: Date | null;

  @Column({ name: 'cbms_status', type: 'varchar', default: 'NOT_REQUIRED' })
  cbmsStatus: CbmsPushStatus;

  @Column({ name: 'cbms_reference', type: 'varchar', nullable: true })
  cbmsReference: string | null;

  @Column({ name: 'cbms_error', type: 'text', nullable: true })
  cbmsError: string | null;

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

  @OneToMany(() => SalesInvoiceLineEntity, (line) => line.invoice)
  lines: SalesInvoiceLineEntity[];
}
