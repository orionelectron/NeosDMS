import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { ItemEntity } from './item.entity';
import { UomEntity } from './uom.entity';

@Entity('uom_conversions')
@Index(
  'uq_uom_conversions_org_item_from_to',
  ['organizationId', 'itemId', 'fromUomId', 'toUomId'],
  {
    unique: true,
    where: '"item_id" IS NOT NULL',
  },
)
@Index(
  'uq_uom_conversions_org_from_to',
  ['organizationId', 'fromUomId', 'toUomId'],
  {
    unique: true,
    where: '"item_id" IS NULL',
  },
)
@Check('chk_uom_conversions_factor', '"conversion_factor" > 0')
export class UomConversionEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  /** NULL = org-wide default conversion; set = per-item override. */
  @Column({ name: 'item_id', type: 'uuid', nullable: true })
  itemId: string | null;

  @ManyToOne(() => ItemEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'item_id' })
  item: ItemEntity | null;

  @Column({ name: 'from_uom_id', type: 'uuid' })
  fromUomId: string;

  @ManyToOne(() => UomEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'from_uom_id' })
  fromUom: UomEntity;

  @Column({ name: 'to_uom_id', type: 'uuid' })
  toUomId: string;

  @ManyToOne(() => UomEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'to_uom_id' })
  toUom: UomEntity;

  @Column({
    name: 'conversion_factor',
    type: 'decimal',
    precision: 15,
    scale: 6,
  })
  conversionFactor: string;
}
