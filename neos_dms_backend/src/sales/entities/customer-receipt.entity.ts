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
import { AccountEntity } from '../../accounting/entities/account.entity';
import { FiscalYearEntity } from '../../accounting/entities/fiscal-year.entity';
import { JournalEntryEntity } from '../../accounting/entities/journal-entry.entity';
import { PartyEntity } from '../../accounting/entities/party.entity';
import { PaymentMethodEntity } from '../../accounting/entities/payment-method.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { BranchEntity } from '../../tenancy/entities/branch.entity';
import type { CustomerReceiptStatus } from '../sales.constants';
import { CustomerReceiptAllocationEntity } from './customer-receipt-allocation.entity';

/**
 * Customer receipt — the money-in voucher mirroring supplier payments. A
 * receipt allocates a paid amount against one or more posted sales invoices;
 * Σ allocations must fully consume the paid amount (no advances in MVP) and
 * each must be ≤ the invoice's outstanding `balance_amount` at POST. POST
 * reserves the `RCV-` number and posts `DR receipt account / CR AR (party)`.
 */
@Entity('customer_receipts')
@Index('uq_customer_receipts_org_number', ['organizationId', 'receiptNumber'], {
  unique: true,
})
@Index('idx_customer_receipts_org_status', ['organizationId', 'status'])
@Index('idx_customer_receipts_org_party', ['organizationId', 'partyId'])
@Index('idx_customer_receipts_org_date', ['organizationId', 'receiptDate'])
@Check(
  'chk_customer_receipts_status',
  "status IN ('DRAFT','POSTED','CANCELLED')",
)
@Check('chk_customer_receipts_amount', 'received_amount >= 0')
export class CustomerReceiptEntity extends BaseEntity {
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

  /** Receipt voucher number (`RCV-…`); reserved at POST, drafts stay null. */
  @Column({ name: 'receipt_number', type: 'varchar', nullable: true })
  receiptNumber: string | null;

  @Column({ name: 'fiscal_year_id', type: 'uuid', nullable: true })
  fiscalYearId: string | null;

  @ManyToOne(() => FiscalYearEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'fiscal_year_id' })
  fiscalYear: FiscalYearEntity | null;

  /** The customer paying. */
  @Column({ name: 'party_id', type: 'uuid' })
  partyId: string;

  @ManyToOne(() => PartyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'party_id' })
  party: PartyEntity;

  @Column({ name: 'payment_method_id', type: 'uuid' })
  paymentMethodId: string;

  @ManyToOne(() => PaymentMethodEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod: PaymentMethodEntity;

  /** The account money arrives in (cash/bank/other asset). */
  @Column({ name: 'receipt_account_id', type: 'uuid' })
  receiptAccountId: string;

  @ManyToOne(() => AccountEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'receipt_account_id' })
  receiptAccount: AccountEntity;

  @Column({ name: 'receipt_date', type: 'date', nullable: true })
  receiptDate: string | null;

  @Column({ name: 'receipt_date_bs', type: 'varchar', nullable: true })
  receiptDateBs: string | null;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status: CustomerReceiptStatus;

  /** Total money received = Σ allocations (advances not allowed in MVP). */
  @Column({ name: 'received_amount', type: 'decimal', precision: 15, scale: 2 })
  receivedAmount: string;

  /** Bank reference / cheque / wallet transaction id. */
  @Column({ name: 'reference_no', type: 'varchar', nullable: true })
  referenceNo: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'journal_entry_id', type: 'uuid', nullable: true })
  journalEntryId: string | null;

  @ManyToOne(() => JournalEntryEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'journal_entry_id' })
  journalEntry: JournalEntryEntity | null;

  @OneToMany(
    () => CustomerReceiptAllocationEntity,
    (allocation) => allocation.receipt,
  )
  allocations: CustomerReceiptAllocationEntity[];
}
