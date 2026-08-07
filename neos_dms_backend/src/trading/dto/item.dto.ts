import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { IsBoolean, IsIn } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  INVENTORY_TRACKING,
  ITEM_TYPE,
  VALUATION_METHOD,
} from '../trading.constants';

export class CreateItemDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(ITEM_TYPE)
  type?: (typeof ITEM_TYPE)[number];

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsUUID()
  baseUomId: string;

  @IsOptional()
  @IsString()
  hsnCode?: string;

  @IsOptional()
  @IsIn(VALUATION_METHOD)
  valuationMethod?: (typeof VALUATION_METHOD)[number];

  @IsOptional()
  @IsUUID()
  taxCodeId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  mrp?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salePrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  standardCost?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsIn(INVENTORY_TRACKING)
  inventoryTracking?: (typeof INVENTORY_TRACKING)[number];

  @IsOptional()
  @IsBoolean()
  trackExpiry?: boolean;

  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @IsOptional()
  @IsUUID()
  salesAccountId?: string;

  @IsOptional()
  @IsUUID()
  purchaseAccountId?: string;

  @IsOptional()
  @IsUUID()
  salesReturnAccountId?: string;

  @IsOptional()
  @IsUUID()
  purchaseReturnAccountId?: string;
}

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsOptional()
  @IsString()
  sku?: string | null;

  @IsOptional()
  @IsString()
  barcode?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(ITEM_TYPE)
  type?: (typeof ITEM_TYPE)[number];

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  @IsOptional()
  @IsUUID()
  baseUomId?: string;

  @IsOptional()
  @IsString()
  hsnCode?: string | null;

  @IsOptional()
  @IsIn(VALUATION_METHOD)
  valuationMethod?: (typeof VALUATION_METHOD)[number];

  @IsOptional()
  @IsUUID()
  taxCodeId?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  mrp?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salePrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  standardCost?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsIn(INVENTORY_TRACKING)
  inventoryTracking?: (typeof INVENTORY_TRACKING)[number];

  @IsOptional()
  @IsBoolean()
  trackExpiry?: boolean;

  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @IsOptional()
  @IsUUID()
  salesAccountId?: string | null;

  @IsOptional()
  @IsUUID()
  purchaseAccountId?: string | null;

  @IsOptional()
  @IsUUID()
  salesReturnAccountId?: string | null;

  @IsOptional()
  @IsUUID()
  purchaseReturnAccountId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ItemListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
