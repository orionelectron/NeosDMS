import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { IrdCategory } from '../accounting.constants';
import { AccountEntity } from './account.entity';
import { TaxTypeEntity } from './tax-type.entity';

@Entity('tax_codes')
@Index('uq_tax_codes_org_name', ['organizationId', 'name'], {
  unique: true,
})
export class TaxCodeEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'tax_type_id', type: 'uuid' })
  taxTypeId: string;

  @ManyToOne(() => TaxTypeEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tax_type_id' })
  taxType: TaxTypeEntity;

  @Column({ name: 'account_id', type: 'uuid', nullable: true })
  accountId: string | null;

  @ManyToOne(() => AccountEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'account_id' })
  account: AccountEntity | null;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', name: 'ird_category', default: 'TAXABLE' })
  irdCategory: IrdCategory;

  @Column({ type: 'decimal', precision: 7, scale: 4, default: 0 })
  rate: string;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: Date | null;

  @Column({ name: 'is_locked', type: 'boolean', default: true })
  isLocked: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
