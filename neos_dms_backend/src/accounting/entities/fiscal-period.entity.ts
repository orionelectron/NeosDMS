import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { FiscalYearEntity } from './fiscal-year.entity';

@Entity('fiscal_periods')
@Index('uq_fiscal_periods_year_sequence', ['fiscalYearId', 'sequence'], {
  unique: true,
})
@Index('uq_fiscal_periods_year_name', ['fiscalYearId', 'name'], {
  unique: true,
})
@Index('idx_fiscal_periods_year_dates', [
  'fiscalYearId',
  'startDate',
  'endDate',
])
export class FiscalPeriodEntity extends BaseEntity {
  @Column({ name: 'fiscal_year_id', type: 'uuid' })
  fiscalYearId: string;

  @ManyToOne(() => FiscalYearEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fiscal_year_id' })
  fiscalYear: FiscalYearEntity;

  /** e.g. "Baisakh" */
  @Column({ type: 'varchar' })
  name: string;

  /** 1 (Baisakh) … 12 (Chaitra) */
  @Column({ type: 'integer' })
  sequence: number;

  @Column({ type: 'varchar', length: 10, name: 'start_date_bs' })
  startDateBs: string;

  @Column({ type: 'varchar', length: 10, name: 'end_date_bs' })
  endDateBs: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt: Date | null;

  @Column({ name: 'locked_by', type: 'uuid', nullable: true })
  lockedBy: string | null;
}
