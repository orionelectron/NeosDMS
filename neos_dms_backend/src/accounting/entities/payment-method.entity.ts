import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { MethodType } from '../accounting.constants';
import { AccountEntity } from './account.entity';

@Entity('payment_methods')
@Index('uq_payment_methods_org_name', ['organizationId', 'name'], {
  unique: true,
})
export class PaymentMethodEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'linked_account_id', type: 'uuid', nullable: true })
  linkedAccountId: string | null;

  @ManyToOne(() => AccountEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'linked_account_id' })
  linkedAccount: AccountEntity | null;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', name: 'method_type' })
  methodType: MethodType;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
