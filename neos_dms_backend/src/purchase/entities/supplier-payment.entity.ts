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
import type { SupplierPaymentStatus } from '../purchase.constants';
import { SupplierPaymentBillAllocationEntity } from './supplier-payment-bill-allocation.entity';

@Entity('supplier_payments')
@Index('uq_supplier_payments_org_number', ['organizationId', 'paymentNumber'], {
  unique: true,
})
@Index('idx_supplier_payments_org_status', ['organizationId', 'status'])
@Index('idx_supplier_payments_org_party', ['organizationId', 'partyId'])
@Index('idx_supplier_payments_org_date', ['organizationId', 'paymentDate'])
@Check(
  'chk_supplier_payments_status',
  "status IN ('DRAFT','POSTED','CANCELLED')",
)
@Check('chk_supplier_payments_amount', 'paid_amount >= 0')
export class SupplierPaymentEntity extends BaseEntity {
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

  /** Payment voucher number (`PMT-…`); reserved at POST, drafts stay null. */
  @Column({ name: 'payment_number', type: 'varchar', nullable: true })
  paymentNumber: string | null;

  @Column({ name: 'fiscal_year_id', type: 'uuid', nullable: true })
  fiscalYearId: string | null;

  @ManyToOne(() => FiscalYearEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'fiscal_year_id' })
  fiscalYear: FiscalYearEntity | null;

  /** The supplier being paid. */
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

  /** The account money leaves (cash/bank/other asset). */
  @Column({ name: 'payment_account_id', type: 'uuid' })
  paymentAccountId: string;

  @ManyToOne(() => AccountEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payment_account_id' })
  paymentAccount: AccountEntity;

  @Column({ name: 'payment_date', type: 'date', nullable: true })
  paymentDate: string | null;

  @Column({ name: 'payment_date_bs', type: 'varchar', nullable: true })
  paymentDateBs: string | null;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status: SupplierPaymentStatus;

  /** Total money paid = Σ allocations (advances not allowed in MVP). */
  @Column({ name: 'paid_amount', type: 'decimal', precision: 15, scale: 2 })
  paidAmount: string;

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
    () => SupplierPaymentBillAllocationEntity,
    (allocation) => allocation.payment,
  )
  allocations: SupplierPaymentBillAllocationEntity[];
}
