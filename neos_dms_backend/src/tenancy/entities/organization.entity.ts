import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { SubscriptionEntity } from '../../subscription/entities/subscription.entity';
import { BranchEntity } from './branch.entity';

@Entity('organizations')
export class OrganizationEntity extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', name: 'legal_name', nullable: true })
  legalName: string | null;

  @Column({ type: 'varchar', name: 'trade_name', nullable: true })
  tradeName: string | null;

  @Column({ type: 'varchar' })
  @Index()
  email: string;

  @Column({ type: 'varchar', name: 'phone_number' })
  @Index()
  phoneNumber: string;

  @Column({ type: 'varchar', name: 'pan_number', unique: true })
  panNumber: string;

  @Column({ type: 'varchar', name: 'vat_number', unique: true, nullable: true })
  vatNumber: string | null;

  @Column({ type: 'varchar', name: 'logo_url', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @OneToMany(() => BranchEntity, (branch) => branch.organization)
  branches: BranchEntity[];

  @OneToMany(() => SubscriptionEntity, (sub) => sub.organization)
  subscriptions: SubscriptionEntity[];
}
