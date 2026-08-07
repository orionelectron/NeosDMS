import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { VISIT_STATUS, VISIT_TYPE } from '../field.constants';

export class CreateVisitDto {
  @IsUUID()
  routeId: string;

  @IsUUID()
  outletId: string;

  @IsOptional()
  @IsIn(VISIT_TYPE)
  visitType?: (typeof VISIT_TYPE)[number];
}

export class CheckInVisitDto {
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @IsString()
  photoKey?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CheckOutVisitDto {
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @IsString()
  photoKey?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class VisitListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsIn(VISIT_STATUS)
  status?: (typeof VISIT_STATUS)[number];
}
