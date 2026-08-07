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
import { BranchEntity } from '../../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { JournalStatus } from '../accounting.constants';
import { CurrencyEntity } from './currency.entity';
import { FiscalPeriodEntity } from './fiscal-period.entity';
import { FiscalYearEntity } from './fiscal-year.entity';
import { JournalLineEntity } from './journal-line.entity';

@Entity('journal_entries')
@Index('idx_journal_entries_org_date', ['organizationId', 'entryDate'])
@Index('idx_journal_entries_org_source', [
  'organizationId',
  'sourceType',
  'sourceId',
])
@Index(
  'uq_journal_entries_source',
  ['organizationId', 'sourceType', 'sourceId'],
  {
    unique: true,
    where: 'source_type IS NOT NULL AND source_id IS NOT NULL',
  },
)
@Check(
  'chk_journal_entries_status',
  "status IN ('DRAFT', 'POSTED', 'CANCELLED')",
)
export class JournalEntryEntity extends BaseEntity {
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

  @Column({ name: 'fiscal_year_id', type: 'uuid' })
  fiscalYearId: string;

  @ManyToOne(() => FiscalYearEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fiscal_year_id' })
  fiscalYear: FiscalYearEntity;

  @Column({ name: 'fiscal_period_id', type: 'uuid' })
  fiscalPeriodId: string;

  @ManyToOne(() => FiscalPeriodEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fiscal_period_id' })
  fiscalPeriod: FiscalPeriodEntity;

  @Column({ name: 'currency_id', type: 'uuid', nullable: true })
  currencyId: string | null;

  @ManyToOne(() => CurrencyEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'currency_id' })
  currency: CurrencyEntity | null;

  @Column({
    name: 'exchange_rate',
    type: 'decimal',
    precision: 15,
    scale: 6,
    default: 1.0,
  })
  exchangeRate: string;

  @Column({ name: 'entry_date', type: 'date' })
  entryDate: Date;

  @Column({
    type: 'varchar',
    length: 10,
    name: 'entry_date_bs',
    nullable: true,
  })
  entryDateBs: string | null;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ name: 'reference_number', type: 'varchar', nullable: true })
  referenceNumber: string | null;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status: JournalStatus;

  @Column({ name: 'source_type', type: 'varchar', nullable: true })
  sourceType: string | null;

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId: string | null;

  @OneToMany(() => JournalLineEntity, (line) => line.journalEntry)
  lines: JournalLineEntity[];
}
