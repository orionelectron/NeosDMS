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
import type { ExpenseMode, ExpenseStatus } from '../purchase.constants';
import { ExpenseLineEntity } from './expense-line.entity';

/**
 * Expense voucher — the petty-cash / running-cost capture of Phase 7
 * (decision 18, §13). A draft records one or more lines against direct COA
 * expense accounts; POST reserves the `EXP-` number and posts a balanced
 * journal — DR per-line expense account(s) + DR VAT Receivable 1105, CR the
 * payment account (CASH mode) or AP 2101 with the vendor party (CREDIT mode)
 * + CR TDS Payable 2103 (per-line TDS, decision 43).
 */
@Entity('expenses')
@Index('uq_expenses_org_number', ['organizationId', 'expenseNumber'], {
  unique: true,
})
@Index('idx_expenses_org_status', ['organizationId', 'status'])
@Index('idx_expenses_org_party', ['organizationId', 'partyId'])
@Index('idx_expenses_org_date', ['organizationId', 'expenseDate'])
@Check('chk_expenses_status', "status IN ('DRAFT','POSTED','CANCELLED')")
@Check('chk_expenses_mode', "expense_mode IN ('CASH','CREDIT')")
@Check('chk_expenses_total', 'total >= 0')
export class ExpenseEntity extends BaseEntity {
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

  /** Expense voucher number (`EXP-…`); reserved at POST, drafts stay null. */
  @Column({ name: 'expense_number', type: 'varchar', nullable: true })
  expenseNumber: string | null;

  @Column({ name: 'fiscal_year_id', type: 'uuid', nullable: true })
  fiscalYearId: string | null;

  @ManyToOne(() => FiscalYearEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'fiscal_year_id' })
  fiscalYear: FiscalYearEntity | null;

  /**
   * Vendor/payee the cost is attributable to — optional for petty cash
   * (CASH mode), required in CREDIT mode (the AP credit needs a party).
   */
  @Column({ name: 'party_id', type: 'uuid', nullable: true })
  partyId: string | null;

  @ManyToOne(() => PartyEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'party_id' })
  party: PartyEntity | null;

  @Column({ name: 'payment_method_id', type: 'uuid', nullable: true })
  paymentMethodId: string | null;

  @ManyToOne(() => PaymentMethodEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod: PaymentMethodEntity | null;

  /** The account money leaves (cash/bank asset) in CASH mode. */
  @Column({ name: 'payment_account_id', type: 'uuid', nullable: true })
  paymentAccountId: string | null;

  @ManyToOne(() => AccountEntity, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'payment_account_id' })
  paymentAccount: AccountEntity | null;

  /** `CASH` — CR the payment account; `CREDIT` — CR AP 2101 (party). */
  @Column({ name: 'expense_mode', type: 'varchar', default: 'CASH' })
  expenseMode: ExpenseMode;

  @Column({ name: 'expense_date', type: 'date', nullable: true })
  expenseDate: string | null;

  @Column({ name: 'expense_date_bs', type: 'varchar', nullable: true })
  expenseDateBs: string | null;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status: ExpenseStatus;

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

  /** Sum of line gross amounts net of per-line discounts (pre-tax). */
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  subtotal: string;

  /** Sum of per-line discounts (netted into the expense accounts). */
  @Column({ name: 'discount_total', type: 'decimal', precision: 15, scale: 2 })
  discountTotal: string;

  /** Input VAT (DR VAT Receivable 1105). */
  @Column({ name: 'tax_total', type: 'decimal', precision: 15, scale: 2 })
  taxTotal: string;

  /** Sum of per-line TDS withheld (CR TDS Payable 2103). */
  @Column({ name: 'tds_total', type: 'decimal', precision: 15, scale: 2 })
  tdsTotal: string;

  /** Total charged = subtotal + tax_total; CR side = total − tds_total. */
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  total: string;

  /** Short business reason for the cost (petty-cash friendly). */
  @Column({ type: 'text', nullable: true })
  purpose: string | null;

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

  @OneToMany(() => ExpenseLineEntity, (line) => line.expense)
  lines: ExpenseLineEntity[];
}
