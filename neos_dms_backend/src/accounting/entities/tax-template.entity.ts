import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import type { IrdCategory } from '../accounting.constants';
import { TaxTypeEntity } from './tax-type.entity';

@Entity('tax_templates')
@Check('chk_tax_templates_math_sign', 'math_sign IN (1, -1)')
@Index('uq_tax_templates_name', ['name'], { unique: true })
export class TaxTemplateEntity extends BaseEntity {
  @Column({ name: 'tax_type_id', type: 'uuid' })
  taxTypeId: string;

  @ManyToOne(() => TaxTypeEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tax_type_id' })
  taxType: TaxTypeEntity;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'decimal', precision: 7, scale: 4, default: 0 })
  rate: string;

  @Column({ type: 'varchar', name: 'ird_category' })
  irdCategory: IrdCategory;

  @Column({ name: 'math_sign', type: 'integer', default: 1 })
  mathSign: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
