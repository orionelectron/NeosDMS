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
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { BranchEntity } from '../../tenancy/entities/branch.entity';
import { PartyEntity } from '../../accounting/entities/party.entity';
import { UserEntity } from '../../iam/entities/user.entity';
import type { SalesOrderStatus } from '../sales.constants';
import { SalesOrderLineEntity } from './sales-order-line.entity';

@Entity('sales_orders')
@Index('uq_sales_orders_org_number', ['organizationId', 'orderNumber'], {
  unique: true,
})
@Index('idx_sales_orders_org_status', ['organizationId', 'status'])
@Index('idx_sales_orders_org_party', ['organizationId', 'partyId'])
@Index('idx_sales_orders_org_salesperson', ['organizationId', 'salespersonId'])
@Check(
  'chk_sales_orders_status',
  "status IN ('DRAFT','CONFIRMED','COMPLETED','CANCELED')",
)
@Check('chk_sales_orders_total', 'total >= 0')
export class SalesOrderEntity extends BaseEntity {
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

  @Column({ name: 'order_number', type: 'varchar' })
  orderNumber: string;

  @Column({ name: 'party_id', type: 'uuid' })
  partyId: string;

  @ManyToOne(() => PartyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'party_id' })
  party: PartyEntity;

  @Column({ name: 'salesperson_id', type: 'uuid' })
  salespersonId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'salesperson_id' })
  salesperson: UserEntity;

  @Column({ type: 'varchar' })
  status: SalesOrderStatus;

  @Column({ name: 'bs_date', type: 'varchar' })
  bsDate: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  total: string;

  /** Order-level fixed discount (NPR), applied after the per-line discounts. */
  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  discountAmount: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Free-text remarks from the customer (delivery notes, requests, etc.). */
  @Column({
    name: 'customer_remarks',
    type: 'text',
    nullable: true,
  })
  customerRemarks: string | null;

  @OneToMany(() => SalesOrderLineEntity, (line) => line.order)
  lines: SalesOrderLineEntity[];
}
