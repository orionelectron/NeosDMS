import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { PermissionEntity } from './permission.entity';
import { RoleEntity } from './role.entity';

/**
 * Role ↔ permission link. The org scope is inherited from the role, so no
 * `organization_id` column (reference's nullable column was redundant).
 */
@Entity('role_permission_mappings')
@Index('uq_role_permission_mappings', ['roleId', 'permissionId'], {
  unique: true,
})
export class RolePermissionMappingEntity extends BaseEntity {
  @Column({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @ManyToOne(() => RoleEntity, (role) => role.permissionMappings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'role_id' })
  role: RoleEntity;

  @Column({ name: 'permission_id', type: 'uuid' })
  permissionId: string;

  @ManyToOne(() => PermissionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: PermissionEntity;
}
