import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CUSTOMER_RECEIPT_STATUSES } from '../sales.constants';

export class CustomerReceiptAllocationDto {
  /** Posted sales invoice the receipt settles against. */
  @IsUUID()
  salesInvoiceId: string;

  /** Amount collected against this invoice. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999999.99)
  allocatedAmount: number;
}

export class CreateCustomerReceiptDto {
  /** Active customer (is_customer) paying. */
  @IsUUID()
  partyId: string;

  @IsUUID()
  paymentMethodId: string;

  /** The account the money arrives in (active asset account). */
  @IsUUID()
  receiptAccountId: string;

  /**
   * Invoices to collect against. Σ allocations must fully consume the paid
   * amount (no advances in MVP) and each must be ≤ the invoice's
   * outstanding balance.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CustomerReceiptAllocationDto)
  allocations: CustomerReceiptAllocationDto[];

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCustomerReceiptDto {
  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @IsOptional()
  @IsUUID()
  receiptAccountId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CustomerReceiptAllocationDto)
  allocations?: CustomerReceiptAllocationDto[];

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CustomerReceiptQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(CUSTOMER_RECEIPT_STATUSES)
  status?: (typeof CUSTOMER_RECEIPT_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  partyId?: string;
}
