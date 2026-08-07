import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateBrandDto {
  @IsString()
  name: string;
}

export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BrandListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}
