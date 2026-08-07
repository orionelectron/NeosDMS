import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { SALES_TARGET_TYPE } from '../field.constants';

export class CreateSalesTargetDto {
  @IsUUID()
  userId: string;

  @IsInt()
  @Type(() => Number)
  @Min(2070)
  @Max(2110)
  bsYear: number;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  bsMonth: number;

  @IsIn([...SALES_TARGET_TYPE])
  targetType: (typeof SALES_TARGET_TYPE)[number];

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class UpdateSalesTargetDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SalesTargetQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsIn([...SALES_TARGET_TYPE])
  targetType?: (typeof SALES_TARGET_TYPE)[number];

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(2070)
  @Max(2110)
  bsYear?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  bsMonth?: number;
}

export class SalesTargetReportQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['mine', 'team', 'all'])
  scope?: 'mine' | 'team' | 'all';

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(2070)
  @Max(2110)
  bsYear?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  bsMonth?: number;
}
