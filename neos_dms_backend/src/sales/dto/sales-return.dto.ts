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
import { SALES_RETURN_STATUSES } from '../sales.constants';

export class SalesReturnLineDto {
  /** Source posted sales-invoice line the return reverses. */
  @IsUUID()
  sourceSalesInvoiceLineId: string;

  /**
   * Returned quantity in the source line's uom. Defaults to the source
   * line's remaining quantity (`base_quantity − returned_quantity`).
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(999999999999.999)
  quantity?: number;
}

export class CreateSalesReturnDto {
  /** Active customer (is_customer) receiving the credit. */
  @IsUUID()
  partyId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesReturnLineDto)
  lines: SalesReturnLineDto[];

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  returnReason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSalesReturnDto {
  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesReturnLineDto)
  lines?: SalesReturnLineDto[];

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  returnReason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PostSalesReturnDto {
  /**
   * Godown the returned goods re-enter. Any active location is accepted —
   * invoices do not store their shipping location.
   */
  @IsUUID()
  inventoryLocationId: string;
}

export class SalesReturnQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(SALES_RETURN_STATUSES)
  status?: (typeof SALES_RETURN_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  partyId?: string;
}
