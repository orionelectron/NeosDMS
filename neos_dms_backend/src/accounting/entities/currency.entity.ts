import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';

@Entity('currencies')
@Index('idx_currencies_org', ['organizationId'])
export class CurrencyEntity extends BaseEntity {
  /** null = global/system currency (e.g. the seeded NPR base). */
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity | null;

  @Column({ type: 'varchar', length: 3 })
  code: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  symbol: string | null;

  @Column({ type: 'integer', default: 2 })
  precision: number;

  @Column({ name: 'is_base', type: 'boolean', default: false })
  isBase: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
