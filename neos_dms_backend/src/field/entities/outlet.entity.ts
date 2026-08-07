import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { PartyEntity } from '../../accounting/entities/party.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { OutletChannel, OutletStatus } from '../field.constants';

/**
 * Customer-facing (field-sales) view of a party (decision 23): `party_id`
 * links to the accounting `parties` record. Created automatically as a
 * customer party when an outlet is created without one.
 */
@Entity('outlets')
@Index('uq_outlets_org_name', ['organizationId', 'name'], { unique: true })
export class OutletEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'party_id', type: 'uuid', nullable: true })
  partyId: string | null;

  @ManyToOne(() => PartyEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'party_id' })
  party: PartyEntity | null;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ name: 'owner_name', type: 'varchar', nullable: true })
  ownerName: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', nullable: true })
  province: string | null;

  @Column({ type: 'varchar', nullable: true })
  district: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @Column({ name: 'photo_key', type: 'varchar', nullable: true })
  photoKey: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', default: 'GENERAL_TRADE' })
  channel: OutletChannel;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column({ type: 'varchar', default: 'ACTIVE' })
  status: OutletStatus;
}
