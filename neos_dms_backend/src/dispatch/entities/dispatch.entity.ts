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
import { RouteEntity } from '../../field/entities/route.entity';
import { UserEntity } from '../../iam/entities/user.entity';
import { InventoryLocationEntity } from '../../inventory/entities/inventory-location.entity';
import { BranchEntity } from '../../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { DispatchStatus } from '../dispatch.constants';
import { VehicleEntity } from './vehicle.entity';
import { DispatchStopEntity } from './dispatch-stop.entity';

/**
 * One delivery run (vehicle + driver) carrying several allocated orders as
 * stops. Dispatch itself never moves stock and never posts a journal — the
 * only stock event is the per-stop sales-invoice POST at `depart`.
 */
@Entity('dispatches')
@Index('uq_dispatches_org_number', ['organizationId', 'dispatchNumber'], {
  unique: true,
})
@Index('idx_dispatches_org_status', ['organizationId', 'status'])
@Index('idx_dispatches_org_driver', ['organizationId', 'driverId'])
@Index('idx_dispatches_org_vehicle', ['organizationId', 'vehicleId'])
@Check(
  'chk_dispatches_status',
  "status IN ('ALLOCATED','LOADED','IN_TRANSIT','DELIVERED','CANCELLED')",
)
export class DispatchEntity extends BaseEntity {
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

  /** `DSP-…` reserved at create via document_sequences (decision 25). */
  @Column({ name: 'dispatch_number', type: 'varchar' })
  dispatchNumber: string;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId: string | null;

  @ManyToOne(() => VehicleEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: VehicleEntity | null;

  @Column({ name: 'driver_id', type: 'uuid', nullable: true })
  driverId: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'driver_id' })
  driver: UserEntity | null;

  @Column({ name: 'route_id', type: 'uuid', nullable: true })
  routeId: string | null;

  @ManyToOne(() => RouteEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'route_id' })
  route: RouteEntity | null;

  /** Stock-out location used for the depart invoices. */
  @Column({
    name: 'source_inventory_location_id',
    type: 'uuid',
    nullable: true,
  })
  sourceInventoryLocationId: string | null;

  @ManyToOne(() => InventoryLocationEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'source_inventory_location_id' })
  sourceInventoryLocation: InventoryLocationEntity | null;

  @Column({ type: 'varchar', default: 'ALLOCATED' })
  status: DispatchStatus;

  @Column({ name: 'planned_departure_at', type: 'timestamptz', nullable: true })
  plannedDepartureAt: Date | null;

  @Column({ name: 'departed_at', type: 'timestamptz', nullable: true })
  departedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => DispatchStopEntity, (stop) => stop.dispatch)
  stops: DispatchStopEntity[];
}
