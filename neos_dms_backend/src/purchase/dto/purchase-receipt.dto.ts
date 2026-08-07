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
import { PURCHASE_RECEIPT_STATUSES } from '../purchase.constants';

export class PurchaseReceiptLineDto {
  @IsUUID()
  itemId: string;

  @IsUUID()
  uomId: string;

  /** Received quantity in the line's uom. */
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(999999999999.999)
  quantity: number;

  /** Defaults to the item's standard cost; seeds the later purchase bill. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost?: number;
}

export class CreatePurchaseReceiptDto {
  /** Active supplier (is_supplier) receiving goods from. */
  @IsUUID()
  partyId: string;

  /** Godown the received goods land in. */
  @IsUUID()
  inventoryLocationId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseReceiptLineDto)
  lines: PurchaseReceiptLineDto[];

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePurchaseReceiptDto {
  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsUUID()
  inventoryLocationId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseReceiptLineDto)
  lines?: PurchaseReceiptLineDto[];

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PurchaseReceiptQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(PURCHASE_RECEIPT_STATUSES)
  status?: (typeof PURCHASE_RECEIPT_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsUUID()
  inventoryLocationId?: string;
}
