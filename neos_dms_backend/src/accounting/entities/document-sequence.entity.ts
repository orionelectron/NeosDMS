import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { BranchEntity } from '../../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { FiscalYearEntity } from './fiscal-year.entity';

/**
 * Per-scope running number for a document type. Uniqueness is the raw
 * `doc_seq_unique` expression index on
 * (organization_id, COALESCE(branch_id, 0), COALESCE(fiscal_year_id, 0),
 * document_type) — created in the migration.
 */
@Entity('document_sequences')
export class DocumentSequenceEntity extends BaseEntity {
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

  @Column({ name: 'fiscal_year_id', type: 'uuid', nullable: true })
  fiscalYearId: string | null;

  @ManyToOne(() => FiscalYearEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'fiscal_year_id' })
  fiscalYear: FiscalYearEntity | null;

  @Column({ type: 'varchar', name: 'document_type' })
  documentType: string;

  @Column({ type: 'varchar', nullable: true })
  prefix: string | null;

  @Column({ name: 'last_number', type: 'integer', default: 0 })
  lastNumber: number;
}
