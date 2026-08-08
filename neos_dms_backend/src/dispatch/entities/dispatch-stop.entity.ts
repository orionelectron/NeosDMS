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
import { SalesInvoiceEntity } from '../../sales/entities/sales-invoice.entity';
import { SalesOrderEntity } from '../../sales/entities/sales-order.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import type { DispatchStopStatus, FailureReason } from '../dispatch.constants';
import { DispatchEntity } from './dispatch.entity';
import { DispatchStopLineEntity } from './dispatch-stop-line.entity';

/**
 * One stop = one allocated order on the run. The partial unique index
 * `uq_dispatch_stops_org_order_active` (org, order) WHERE `deletedAt IS NULL`
 * guarantees an order can never sit on two active runs.
 */
@Entity('dispatch_stops')
@Index('uq_dispatch_stops_dispatch_seq', ['dispatchId', 'stopSequence'], {
  unique: true,
})
@Index('uq_dispatch_stops_org_order_active', ['organizationId', 'orderId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
@Index('uq_dispatch_stops_org_event', ['organizationId', 'deliveryEventId'], {
  unique: true,
  where: 'delivery_event_id IS NOT NULL',
})
@Index('idx_dispatch_stops_org_status', ['organizationId', 'status'])
@Index('idx_dispatch_stops_org_order', ['organizationId', 'orderId'])
@Check(
  'chk_dispatch_stops_status',
  "status IN ('PENDING','DELIVERED','PARTIAL','FAILED')",
)
@Check(
  'chk_dispatch_stops_reason',
  "failure_reason IS NULL OR failure_reason IN ('CUSTOMER_UNAVAILABLE','ROAD_BLOCKED','REJECTED','WRONG_ADDRESS','DAMAGED')",
)
export class DispatchStopEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'dispatch_id', type: 'uuid' })
  dispatchId: string;

  @ManyToOne(() => DispatchEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dispatch_id' })
  dispatch: DispatchEntity;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => SalesOrderEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: SalesOrderEntity;

  @Column({ name: 'stop_sequence', type: 'integer' })
  stopSequence: number;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: DispatchStopStatus;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({ name: 'failure_reason', type: 'varchar', nullable: true })
  failureReason: FailureReason | null;

  // ── Proof of Delivery ─────────────────────────────────────────────────────
  @Column({ name: 'pod_receiver_name', type: 'varchar', nullable: true })
  podReceiverName: string | null;

  @Column({ name: 'pod_signature_photo_key', type: 'varchar', nullable: true })
  podSignaturePhotoKey: string | null;

  @Column({
    name: 'pod_gps_latitude',
    type: 'numeric',
    precision: 10,
    scale: 6,
    nullable: true,
  })
  podGpsLatitude: string | null;

  @Column({
    name: 'pod_gps_longitude',
    type: 'numeric',
    precision: 10,
    scale: 6,
    nullable: true,
  })
  podGpsLongitude: string | null;

  @Column({ name: 'pod_notes', type: 'text', nullable: true })
  podNotes: string | null;

  /** Stamped at `depart` — the sales invoice that shipped this stop's goods. */
  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId: string | null;

  @ManyToOne(() => SalesInvoiceEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice: SalesInvoiceEntity | null;

  /** Client-generated idempotency key for queued/offline delivery sync. */
  @Column({ name: 'delivery_event_id', type: 'varchar', nullable: true })
  deliveryEventId: string | null;

  @OneToMany(() => DispatchStopLineEntity, (line) => line.stop)
  lines: DispatchStopLineEntity[];
}
