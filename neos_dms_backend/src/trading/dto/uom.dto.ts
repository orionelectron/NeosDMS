import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateUomDto {
  @IsString()
  name: string;

  @IsString()
  shortName: string;
}

export class UpdateUomDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  shortName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UomListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}
