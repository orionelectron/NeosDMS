import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { UserEntity } from '../../iam/entities/user.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { ApprovalAction, ApprovalEntityType } from '../hr.constants';

/**
 * Shared generic approval trail (decision 28): every submit/approve/reject/
 * cancel on a leave or travel request lands here. The workflow itself lives in
 * the domain service — this is an append-only event record, not a BPM engine.
 */
@Entity('approval_events')
@Index('idx_approval_events_org_entity', [
  'organizationId',
  'entityType',
  'entityId',
])
export class ApprovalEventEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'entity_type', type: 'varchar' })
  entityType: ApprovalEntityType;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actor_id' })
  actor: UserEntity;

  @Column({ type: 'varchar' })
  action: ApprovalAction;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
