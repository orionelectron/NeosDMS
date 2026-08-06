import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { RolePermissionMappingEntity } from './role-permission-mapping.entity';
import { UserEntity } from './user.entity';

/**
 * Org-scoped role (seeded base roles are created per organization on
 * onboarding). `code` gives a stable slug for system references; composite
 * unique `(organization_id, code)` keeps namespaces per-org.
 */
@Entity('roles')
@Index('uq_roles_org_code', ['organizationId', 'code'], { unique: true })
export class RoleEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar' })
  code: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', name: 'is_system', default: false })
  isSystem: boolean;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => RolePermissionMappingEntity, (mapping) => mapping.role)
  permissionMappings: RolePermissionMappingEntity[];

  @OneToMany(() => UserEntity, (user) => user.role)
  users: UserEntity[];
}
