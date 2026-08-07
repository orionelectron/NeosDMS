import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { FiscalPeriodEntity } from './fiscal-period.entity';

@Entity('fiscal_years')
@Index('uq_fiscal_years_org_name', ['organizationId', 'name'], { unique: true })
@Index('idx_fiscal_years_org_dates', ['organizationId', 'startDate', 'endDate'])
export class FiscalYearEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  /** e.g. "2080/81" */
  @Column({ type: 'varchar' })
  name: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @Column({ name: 'is_closed', type: 'boolean', default: false })
  isClosed: boolean;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'closed_by', type: 'uuid', nullable: true })
  closedBy: string | null;

  @OneToMany(() => FiscalPeriodEntity, (period) => period.fiscalYear)
  periods: FiscalPeriodEntity[];
}
