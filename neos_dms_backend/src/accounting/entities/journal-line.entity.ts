import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { BranchEntity } from '../../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { AccountEntity } from './account.entity';
import { JournalEntryEntity } from './journal-entry.entity';
import { PartyEntity } from './party.entity';

@Entity('journal_lines')
@Index('idx_journal_lines_org_account', ['organizationId', 'accountId'])
@Index('idx_journal_lines_org_party', ['organizationId', 'partyId'])
@Check(
  'chk_journal_lines_debit_credit',
  '(debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0)',
)
export class JournalLineEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'branch_id', type: 'uuid' })
  branchId: string;

  @ManyToOne(() => BranchEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch: BranchEntity;

  @Column({ name: 'journal_entry_id', type: 'uuid' })
  journalEntryId: string;

  @ManyToOne(() => JournalEntryEntity, (entry) => entry.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'journal_entry_id' })
  journalEntry: JournalEntryEntity;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @ManyToOne(() => AccountEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account: AccountEntity;

  @Column({ name: 'party_id', type: 'uuid', nullable: true })
  partyId: string | null;

  @ManyToOne(() => PartyEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'party_id' })
  party: PartyEntity | null;

  @Column({
    name: 'debit_amount',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  debitAmount: string;

  @Column({
    name: 'credit_amount',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  creditAmount: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ name: 'is_reconciled', type: 'boolean', default: false })
  isReconciled: boolean;

  @Column({ name: 'reconciled_date', type: 'date', nullable: true })
  reconciledDate: Date | null;
}
