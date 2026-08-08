import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ParseBooleanQuery } from '../../common/transforms/boolean-query.transform';
import { ROUTE_STATUS } from '../field.constants';

export class CreateRouteDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  district?: string;
}

export class UpdateRouteDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  province?: string | null;

  @IsOptional()
  @IsString()
  district?: string | null;

  @IsOptional()
  @IsIn(ROUTE_STATUS)
  status?: (typeof ROUTE_STATUS)[number];
}

export class RouteListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(ROUTE_STATUS)
  status?: (typeof ROUTE_STATUS)[number];
}

export class RouteImportQueryDto {
  @IsOptional()
  @IsIn(['skip', 'update'])
  mode?: 'skip' | 'update';

  @IsOptional()
  @IsBoolean()
  @ParseBooleanQuery()
  dryRun?: boolean;

  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}
