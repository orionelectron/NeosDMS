import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Append-only audit trail. Deliberately does NOT extend BaseEntity — audit
 * rows must not be soft-deleted or carry createdBy/updatedBy of their own.
 */
@Entity('audit_logs')
@Index('idx_audit_logs_org_created', ['organizationId', 'occurredAt'])
@Index('idx_audit_logs_org_entity', ['organizationId', 'entityType'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar' })
  action: string;

  @Column({ type: 'varchar', name: 'entity_type' })
  entityType: string;

  @Column({ type: 'varchar', name: 'entity_id', nullable: true })
  entityId: string | null;

  @Column({ type: 'jsonb', name: 'old_data', nullable: true })
  oldData: Record<string, unknown> | null;

  @Column({ type: 'jsonb', name: 'new_data', nullable: true })
  newData: Record<string, unknown> | null;

  @Column({ type: 'varchar', name: 'ip_address', nullable: true })
  ipAddress: string | null;

  /** BS (Nepali) date of occurrence for the spec's dual AD/BS timestamps. */
  @Column({ type: 'varchar', name: 'bs_date', nullable: true })
  bsDate: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'occurred_at' })
  occurredAt: Date;
}
