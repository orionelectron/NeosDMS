import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';

@Entity('payment_terms')
@Index('uq_payment_terms_org_name', ['organizationId', 'name'], {
  unique: true,
})
export class PaymentTermEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ name: 'due_days', type: 'integer', default: 0 })
  dueDays: number;
}
