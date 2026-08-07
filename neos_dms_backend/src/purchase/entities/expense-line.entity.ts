import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { AccountEntity } from '../../accounting/entities/account.entity';
import { TaxCodeEntity } from '../../accounting/entities/tax-code.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { ExpenseEntity } from './expense.entity';

/**
 * One expense line — a direct charge against a COA account with `EXPENSE`
 * coaType (no items, no uoms, decision 43). The account is the DR leg of the
 * POST journal, net of the line's own discount; the line also carries input
 * VAT and TDS snapshots resolved through the org's tax codes.
 */
@Entity('expense_lines')
@Index('uq_expense_lines_expense_no', ['expenseId', 'lineNo'], {
  unique: true,
})
@Index('idx_expense_lines_expense', ['expenseId'])
@Index('idx_expense_lines_account', ['expenseAccountId'])
@Check('chk_expense_lines_qty', 'quantity > 0')
@Check('chk_expense_lines_unit_amount', 'unit_amount >= 0')
@Check('chk_expense_lines_discount_percent', 'discount_percent >= 0')
@Check('chk_expense_lines_tax_rate', 'tax_rate >= 0')
@Check('chk_expense_lines_tds_rate', 'tds_rate >= 0')
@Check('chk_expense_lines_tax_amount', 'tax_amount >= 0')
@Check('chk_expense_lines_tds_amount', 'tds_amount >= 0')
@Check('chk_expense_lines_total', 'line_total >= 0')
export class ExpenseLineEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'expense_id', type: 'uuid' })
  expenseId: string;

  @ManyToOne(() => ExpenseEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expense_id' })
  expense: ExpenseEntity;

  @Column({ name: 'line_no', type: 'integer' })
  lineNo: number;

  /** The COA account charged — must have `EXPENSE` coaType (validated at POST). */
  @Column({ name: 'expense_account_id', type: 'uuid' })
  expenseAccountId: string;

  @ManyToOne(() => AccountEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expense_account_id' })
  expenseAccount: AccountEntity;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity: string;

  @Column({ name: 'unit_amount', type: 'decimal', precision: 15, scale: 2 })
  unitAmount: string;

  /** quantity × unit_amount — before the line's own discount. */
  @Column({ name: 'gross_amount', type: 'decimal', precision: 15, scale: 2 })
  grossAmount: string;

  @Column({
    name: 'discount_percent',
    type: 'decimal',
    precision: 7,
    scale: 4,
    default: 0,
  })
  discountPercent: string;

  /** gross_amount × discount_percent — netted into the expense account DR. */
  @Column({ name: 'discount_amount', type: 'decimal', precision: 15, scale: 2 })
  discountAmount: string;

  @Column({ name: 'tax_code_id', type: 'uuid', nullable: true })
  taxCodeId: string | null;

  @ManyToOne(() => TaxCodeEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tax_code_id' })
  taxCode: TaxCodeEntity | null;

  /** Input VAT base snapshot (gross − discount). */
  @Column({ name: 'taxable_amount', type: 'decimal', precision: 15, scale: 2 })
  taxableAmount: string;

  /** Input VAT rate snapshot — a rate change never alters a posted expense. */
  @Column({ name: 'tax_rate', type: 'decimal', precision: 7, scale: 4 })
  taxRate: string;

  /** taxable_amount × tax_rate — DR VAT Receivable 1105 at POST. */
  @Column({ name: 'tax_amount', type: 'decimal', precision: 15, scale: 2 })
  taxAmount: string;

  @Column({ name: 'tds_tax_code_id', type: 'uuid', nullable: true })
  tdsTaxCodeId: string | null;

  @ManyToOne(() => TaxCodeEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tds_tax_code_id' })
  tdsTaxCode: TaxCodeEntity | null;

  /** TDS withholding rate snapshot (1.5% services, 15% professional, …). */
  @Column({ name: 'tds_rate', type: 'decimal', precision: 7, scale: 4 })
  tdsRate: string;

  /** taxable_amount × tds_rate — CR TDS Payable 2103, split off the CR leg. */
  @Column({ name: 'tds_amount', type: 'decimal', precision: 15, scale: 2 })
  tdsAmount: string;

  /** taxable_amount + tax_amount (TDS is a payable split, not part of it). */
  @Column({ name: 'line_total', type: 'decimal', precision: 15, scale: 2 })
  lineTotal: string;
}
