import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

@Entity('modules')
export class ModuleEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  name: string;

  @Column({ type: 'varchar', unique: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;
}
