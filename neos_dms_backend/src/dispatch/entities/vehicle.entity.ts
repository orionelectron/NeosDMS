import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { UserEntity } from '../../iam/entities/user.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { VehicleType } from '../dispatch.constants';

@Entity('vehicles')
@Index('uq_vehicles_org_reg', ['organizationId', 'registrationNumber'], {
  unique: true,
})
@Index('idx_vehicles_org_active', ['organizationId', 'isActive'])
@Check(
  'chk_vehicles_type',
  "vehicle_type IN ('van','truck','pickup','motorbike')",
)
@Check(
  'chk_vehicles_capacity',
  'capacity_weight_kg >= 0 AND capacity_volume_cbm >= 0',
)
export class VehicleEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ name: 'registration_number', type: 'varchar' })
  registrationNumber: string;

  @Column({ name: 'vehicle_type', type: 'varchar', default: 'van' })
  vehicleType: VehicleType;

  /** Decorative in MVP — items do not yet carry weight/volume (P1). */
  @Column({
    name: 'capacity_weight_kg',
    type: 'decimal',
    precision: 15,
    scale: 3,
    nullable: true,
  })
  capacityWeightKg: string | null;

  @Column({
    name: 'capacity_volume_cbm',
    type: 'decimal',
    precision: 15,
    scale: 3,
    nullable: true,
  })
  capacityVolumeCbm: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Reassigned per dispatch; null when the vehicle is idle. */
  @Column({ name: 'current_driver_id', type: 'uuid', nullable: true })
  currentDriverId: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'current_driver_id' })
  currentDriver: UserEntity | null;
}
