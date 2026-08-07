import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { SALES_ORDER_STATUSES } from '../sales.constants';

export class SalesOrderLineDto {
  @IsUUID()
  itemId: string;

  @IsUUID()
  uomId: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(999999999999.999)
  quantity: number;

  /** Free units of the same item — shipped but never billed (default 0). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(999999999999.999)
  freeQuantity?: number;

  /** Defaults to the item's `sale_price` when omitted. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent?: number;
}

export class CreateSalesOrderDto {
  @IsUUID()
  partyId: string;

  /** Defaults to the current user. Managers may order on behalf of a reportee. */
  @IsOptional()
  @IsUUID()
  salespersonId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesOrderLineDto)
  lines: SalesOrderLineDto[];

  /** Order-level fixed discount in NPR (default 0). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Free-text remarks from the customer (delivery notes, requests, etc.). */
  @IsOptional()
  @IsString()
  customerRemarks?: string;
}

export class UpdateSalesOrderDto {
  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsUUID()
  salespersonId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesOrderLineDto)
  lines?: SalesOrderLineDto[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  notes?: string;

  @IsOptional()
  @IsString()
  customerRemarks?: string;
}

export class SalesOrderQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(SALES_ORDER_STATUSES)
  status?: (typeof SALES_ORDER_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsUUID()
  salespersonId?: string;
}
