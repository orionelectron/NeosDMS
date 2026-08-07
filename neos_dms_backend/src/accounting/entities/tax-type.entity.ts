import { Check, Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

@Entity('tax_types')
@Check('chk_tax_types_math_sign', 'math_sign IN (1, -1)')
export class TaxTypeEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  /** 1 = adds to price (VAT), -1 = deducts (TDS). */
  @Column({ name: 'math_sign', type: 'integer', default: 1 })
  mathSign: number;

  @Column({ name: 'is_system', type: 'boolean', default: true })
  isSystem: boolean;
}
