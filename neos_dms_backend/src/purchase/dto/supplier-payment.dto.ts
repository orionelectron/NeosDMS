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
import { SUPPLIER_PAYMENT_STATUSES } from '../purchase.constants';

export class SupplierPaymentAllocationDto {
  /** Posted bill the payment settles against. */
  @IsUUID()
  purchaseBillId: string;

  /** Amount paid against this bill. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999999.99)
  allocatedAmount: number;
}

export class CreateSupplierPaymentDto {
  /** Active supplier (is_supplier) being paid. */
  @IsUUID()
  partyId: string;

  @IsUUID()
  paymentMethodId: string;

  /** The account the money leaves (active asset account). */
  @IsUUID()
  paymentAccountId: string;

  /**
   * Bills to settle. Σ allocations must fully consume the paid amount (no
   * advances in MVP) and each must be ≤ the bill's outstanding balance.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SupplierPaymentAllocationDto)
  allocations: SupplierPaymentAllocationDto[];

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

export class UpdateSupplierPaymentDto {
  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @IsOptional()
  @IsUUID()
  paymentAccountId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SupplierPaymentAllocationDto)
  allocations?: SupplierPaymentAllocationDto[];

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

export class SupplierPaymentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(SUPPLIER_PAYMENT_STATUSES)
  status?: (typeof SUPPLIER_PAYMENT_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  partyId?: string;
}
