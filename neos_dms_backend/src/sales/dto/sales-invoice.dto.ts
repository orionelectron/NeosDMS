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
import { SALES_INVOICE_STATUSES } from '../sales.constants';

export class SalesInvoiceLineDto {
  @IsUUID()
  orderLineId: string;

  /** Billed quantity in the order line's sell uom; must not exceed the remaining. */
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(999999999999.999)
  quantity: number;

  /**
   * Free units shipped with this line — never billed. Defaults to the order
   * line's full free quantity when this invoice bills its entire remaining
   * quantity, otherwise 0.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(999999999999.999)
  freeQuantity?: number;

  /** Defaults to the source order line's unit price. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  /** Defaults to the source order line's discount percent. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent?: number;

  /** Overrides the item's tax code for this line. */
  @IsOptional()
  @IsUUID()
  taxCodeId?: string;
}

export class CreateSalesInvoiceDto {
  @IsUUID()
  salesOrderId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesInvoiceLineDto)
  lines: SalesInvoiceLineDto[];

  /**
   * Header-level fixed discount for this invoice. Defaults to the order's
   * discount_amount × (invoiced subtotal / order line sum) — pro-rata
   * apportionment, editable while the invoice is a draft.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSalesInvoiceDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesInvoiceLineDto)
  lines?: SalesInvoiceLineDto[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PostSalesInvoiceDto {
  /** Warehouse/godown location the shipped quantities are drawn from. */
  @IsUUID()
  inventoryLocationId: string;
}

export class SalesInvoiceQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(SALES_INVOICE_STATUSES)
  status?: (typeof SALES_INVOICE_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsUUID()
  salespersonId?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;
}
