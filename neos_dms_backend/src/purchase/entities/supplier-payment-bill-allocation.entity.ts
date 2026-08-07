import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { PurchaseBillEntity } from './purchase-bill.entity';
import { SupplierPaymentEntity } from './supplier-payment.entity';

/**
 * A payment's allocation against one posted bill. Σ allocations must equal
 * the payment's paid_amount (advances are not allowed in MVP), and each
 * allocation must be ≤ the bill's outstanding balance at POST.
 */
@Entity('supplier_payment_bill_allocations')
@Index(
  'uq_payment_bill_allocations_payment_bill',
  ['supplierPaymentId', 'purchaseBillId'],
  { unique: true },
)
@Index('idx_payment_bill_allocations_payment', ['supplierPaymentId'])
@Index('idx_payment_bill_allocations_bill', ['purchaseBillId'])
@Check('chk_payment_bill_allocations_amount', 'allocated_amount > 0')
export class SupplierPaymentBillAllocationEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'supplier_payment_id', type: 'uuid' })
  supplierPaymentId: string;

  @ManyToOne(() => SupplierPaymentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_payment_id' })
  payment: SupplierPaymentEntity;

  @Column({ name: 'purchase_bill_id', type: 'uuid' })
  purchaseBillId: string;

  @ManyToOne(() => PurchaseBillEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'purchase_bill_id' })
  bill: PurchaseBillEntity;

  @Column({
    name: 'allocated_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  allocatedAmount: string;
}
