import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ParseBooleanQuery } from '../../common/transforms/boolean-query.transform';
import { OUTLET_CHANNEL, OUTLET_STATUS } from '../field.constants';

export class CreateOutletDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsString()
  photoKey?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(OUTLET_CHANNEL)
  channel?: (typeof OUTLET_CHANNEL)[number];

  @IsOptional()
  @IsString()
  category?: string;
}

export class UpdateOutletDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  partyId?: string | null;

  @IsOptional()
  @IsString()
  ownerName?: string | null;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsString()
  province?: string | null;

  @IsOptional()
  @IsString()
  district?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @IsOptional()
  @IsString()
  photoKey?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(OUTLET_CHANNEL)
  channel?: (typeof OUTLET_CHANNEL)[number];

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsIn(OUTLET_STATUS)
  status?: (typeof OUTLET_STATUS)[number];
}

export class OutletListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  routeId?: string;

  @IsOptional()
  @IsIn(OUTLET_STATUS)
  status?: (typeof OUTLET_STATUS)[number];
}

export class OutletImportQueryDto {
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
