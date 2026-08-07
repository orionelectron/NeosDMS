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
import { PURCHASE_RETURN_STATUSES } from '../purchase.constants';

export class PurchaseReturnLineDto {
  /**
   * Source posted bill line — the return reverses the bill's journal and
   * moves stock out at the bill's value. Leave undefined for a never-billed
   * GRN line (stock-out only, no journal).
   */
  @IsOptional()
  @IsUUID()
  sourcePurchaseBillLineId?: string;

  /** Source never-billed posted GRN line — stock-out only (decision 41). */
  @IsOptional()
  @IsUUID()
  sourcePurchaseReceiptLineId?: string;

  /**
   * Returned quantity in the source line's uom. Defaults to the source
   * line's remaining quantity (`quantity − returned_quantity`).
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(999999999999.999)
  quantity?: number;
}

export class CreatePurchaseReturnDto {
  /** Active supplier (is_supplier) being debited. */
  @IsUUID()
  partyId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseReturnLineDto)
  lines: PurchaseReturnLineDto[];

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

export class UpdatePurchaseReturnDto {
  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseReturnLineDto)
  lines?: PurchaseReturnLineDto[];

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

export class PostPurchaseReturnDto {
  /**
   * Godown the returned goods leave from. Must match every source line's
   * document location (the bill's or the receipt's).
   */
  @IsUUID()
  inventoryLocationId: string;
}

export class PurchaseReturnQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(PURCHASE_RETURN_STATUSES)
  status?: (typeof PURCHASE_RETURN_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  partyId?: string;
}
