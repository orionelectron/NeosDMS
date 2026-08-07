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
import { PURCHASE_BILL_STATUSES } from '../purchase.constants';

export class PurchaseBillLineDto {
  /**
   * Source GRN line for journal-only billing (stock already on hand). When
   * present the line's item/uom/quantity default to the receipt line and it
   * bills once, in full; leave undefined for a direct line (stock-in on the
   * bill).
   */
  @IsOptional()
  @IsUUID()
  sourcePurchaseReceiptLineId?: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsUUID()
  uomId?: string;

  /** Direct lines: required. Sourced lines: defaults to the receipt line's remaining quantity (base − billed − returned). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(999999999999.999)
  quantity?: number;

  /** Defaults to the receipt line's unit_cost (sourced) or the item's standard cost. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  /** Overrides the org's input-VAT default for this line. */
  @IsOptional()
  @IsUUID()
  taxCodeId?: string;

  /** Per-line TDS withholding code (decision 43) — must be a TDS_WITHHOLDING code. */
  @IsOptional()
  @IsUUID()
  tdsTaxCodeId?: string;
}

export class CreatePurchaseBillDto {
  /** Active supplier (is_supplier) being billed by. */
  @IsUUID()
  partyId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseBillLineDto)
  lines: PurchaseBillLineDto[];

  /** Header-level discount credited to Discounts Received. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  vendorBillNo?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePurchaseBillDto {
  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseBillLineDto)
  lines?: PurchaseBillLineDto[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  vendorBillNo?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PostPurchaseBillDto {
  /**
   * Godown the goods land in (direct lines) / where the sourced receipts
   * already sit. Every sourced receipt line must share this location.
   */
  @IsUUID()
  inventoryLocationId: string;
}

export class PurchaseBillQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(PURCHASE_BILL_STATUSES)
  status?: (typeof PURCHASE_BILL_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  partyId?: string;
}
