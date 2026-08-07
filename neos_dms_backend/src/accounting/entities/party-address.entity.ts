import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { PartyEntity } from './party.entity';

@Entity('party_addresses')
export class PartyAddressEntity extends BaseEntity {
  @Column({ name: 'party_id', type: 'uuid' })
  partyId: string;

  @ManyToOne(() => PartyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'party_id' })
  party: PartyEntity;

  @Column({ type: 'varchar', name: 'address_type' })
  addressType: string;

  @Column({ type: 'varchar', name: 'address_line_1' })
  addressLine1: string;

  @Column({ type: 'varchar', name: 'address_line_2', nullable: true })
  addressLine2: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'varchar', nullable: true })
  state: string | null;

  @Column({ type: 'varchar', name: 'zip_code', nullable: true })
  zipCode: string | null;

  @Column({ type: 'varchar', default: 'Nepal' })
  country: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;
}
