import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { OrganizationEntity } from '../../tenancy/entities/organization.entity';
import { SalesInvoiceEntity } from './sales-invoice.entity';
import { CustomerReceiptEntity } from './customer-receipt.entity';

/**
 * A receipt's allocation against one posted sales invoice. Σ allocations must
 * equal the receipt's received_amount (advances are not allowed in MVP), and
 * each allocation must be ≤ the invoice's outstanding balance at POST.
 */
@Entity('customer_receipt_invoice_allocations')
@Index(
  'uq_receipt_allocations_receipt_invoice',
  ['customerReceiptId', 'salesInvoiceId'],
  { unique: true },
)
@Index('idx_receipt_allocations_receipt', ['customerReceiptId'])
@Index('idx_receipt_allocations_invoice', ['salesInvoiceId'])
@Check('chk_receipt_allocations_amount', 'allocated_amount > 0')
export class CustomerReceiptAllocationEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @Column({ name: 'customer_receipt_id', type: 'uuid' })
  customerReceiptId: string;

  @ManyToOne(() => CustomerReceiptEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_receipt_id' })
  receipt: CustomerReceiptEntity;

  @Column({ name: 'sales_invoice_id', type: 'uuid' })
  salesInvoiceId: string;

  @ManyToOne(() => SalesInvoiceEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sales_invoice_id' })
  invoice: SalesInvoiceEntity;

  @Column({
    name: 'allocated_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  allocatedAmount: string;
}
