import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { BranchEntity } from '../../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { PartyKind } from '../accounting.constants';
import { CurrencyEntity } from './currency.entity';
import { PartyAddressEntity } from './party-address.entity';
import { PaymentTermEntity } from './payment-term.entity';

@Entity('parties')
@Index('idx_parties_org_pan', ['organizationId', 'panNumber'])
@Index('idx_parties_org_customer', ['organizationId', 'isCustomer'])
@Index('idx_parties_org_supplier', ['organizationId', 'isSupplier'])
@Check(
  'chk_parties_at_least_one_role',
  '(is_customer = true OR is_supplier = true OR is_lead = true)',
)
@Check('chk_parties_kind', "party_kind IN ('BUSINESS','INDIVIDUAL')")
export class PartyEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @ManyToOne(() => BranchEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: BranchEntity | null;

  @Column({ name: 'currency_id', type: 'uuid', nullable: true })
  currencyId: string | null;

  @ManyToOne(() => CurrencyEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'currency_id' })
  currency: CurrencyEntity | null;

  @Column({ name: 'payment_term_id', type: 'uuid', nullable: true })
  paymentTermId: string | null;

  @ManyToOne(() => PaymentTermEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'payment_term_id' })
  paymentTerm: PaymentTermEntity | null;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ name: 'legal_name', type: 'varchar', nullable: true })
  legalName: string | null;

  @Column({ type: 'varchar', name: 'party_kind', default: 'BUSINESS' })
  partyKind: PartyKind;

  @Column({ name: 'is_customer', type: 'boolean', default: false })
  isCustomer: boolean;

  @Column({ name: 'is_supplier', type: 'boolean', default: false })
  isSupplier: boolean;

  @Column({ name: 'is_lead', type: 'boolean', default: false })
  isLead: boolean;

  @Column({ name: 'pan_number', type: 'varchar', nullable: true })
  panNumber: string | null;

  @Column({ name: 'vat_number', type: 'varchar', nullable: true })
  vatNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column({
    name: 'credit_limit',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  creditLimit: string;

  @Column({
    name: 'opening_balance',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  openingBalance: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => PartyAddressEntity, (address) => address.party)
  addresses: PartyAddressEntity[];
}
