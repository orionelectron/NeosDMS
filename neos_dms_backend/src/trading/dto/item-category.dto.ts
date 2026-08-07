import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateItemCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsUUID()
  parentCategoryId?: string;
}

export class UpdateItemCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsOptional()
  @IsUUID()
  parentCategoryId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ItemCategoryListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}
