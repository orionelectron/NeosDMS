import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { BranchEntity } from '../../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { CoaType, SystemPurpose } from '../accounting.constants';

@Entity('accounts')
@Index('uq_accounts_org_code', ['organizationId', 'code'], { unique: true })
@Index('idx_accounts_org_parent', ['organizationId', 'parentAccountId'])
@Index('idx_accounts_org_purpose', ['organizationId', 'systemPurpose'])
@Index('idx_accounts_org_branch', ['organizationId', 'branchId'])
@Check(
  'chk_accounts_coa_type',
  "coa_type IN ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE')",
)
export class AccountEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'parent_account_id', type: 'uuid', nullable: true })
  parentAccountId: string | null;

  @ManyToOne(() => AccountEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'parent_account_id' })
  parentAccount: AccountEntity | null;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  code: string;

  @Column({ type: 'varchar', name: 'coa_type' })
  coaType: CoaType;

  @Column({ name: 'is_group', type: 'boolean', default: false })
  isGroup: boolean;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @ManyToOne(() => BranchEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: BranchEntity | null;

  @Column({ name: 'is_system_account', type: 'boolean', default: false })
  isSystemAccount: boolean;

  @Column({ name: 'system_purpose', type: 'varchar', nullable: true })
  systemPurpose: SystemPurpose | null;

  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Depth in the account tree (1-based). */
  @Column({ type: 'integer', nullable: true })
  level: number | null;

  /** Slash-delimited ancestor path of codes, e.g. "1000/1100/1101". */
  @Column({ type: 'varchar', nullable: true })
  path: string | null;
}
