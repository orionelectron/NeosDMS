import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { ModuleEntity } from '../../tenancy/entities/module.entity';

@Entity('permissions')
export class PermissionEntity extends BaseEntity {
  @Column({ name: 'module_id', type: 'uuid' })
  moduleId: string;

  @ManyToOne(() => ModuleEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'module_id' })
  module: ModuleEntity;

  @Column({ type: 'varchar', unique: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;
}
