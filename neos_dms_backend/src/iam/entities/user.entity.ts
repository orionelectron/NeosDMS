import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { BranchEntity } from '../../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { RoleEntity } from './role.entity';

/**
 * A user belongs to exactly one organization and is assigned to one branch
 * and one role (single-role MVP; email is globally unique for login).
 */
@Entity('users')
@Index('uq_users_email', ['email'], { unique: true })
@Index('idx_users_org', ['organizationId'])
export class UserEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'branch_id', type: 'uuid' })
  branchId: string;

  @ManyToOne(() => BranchEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: BranchEntity;

  @Column({ name: 'role_id', type: 'uuid', nullable: true })
  roleId: string | null;

  @ManyToOne(() => RoleEntity, (role) => role.users, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'role_id' })
  role: RoleEntity | null;

  @Column({ type: 'varchar', name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', nullable: true })
  username: string | null;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar', name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ type: 'boolean', name: 'is_owner', default: false })
  isOwner: boolean;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({
    type: 'boolean',
    name: 'must_change_password',
    default: false,
  })
  mustChangePassword: boolean;

  @Column({ type: 'timestamptz', name: 'last_login_at', nullable: true })
  lastLoginAt: Date | null;

  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'manager_id' })
  manager: UserEntity | null;
}
