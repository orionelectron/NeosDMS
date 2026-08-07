import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ATTENDANCE_SOURCE, ATTENDANCE_STATUS } from '../hr.constants';

export class LocationDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export class CheckInDto extends LocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class CheckOutDto extends LocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class ManualAttendanceDto extends LocationDto {
  @IsUUID()
  userId: string;

  @IsISO8601()
  checkinAt: string;

  @IsOptional()
  @IsISO8601()
  checkoutAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  checkoutRemarks?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  checkoutLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  checkoutLongitude?: number;
}

export class AdjustAttendanceDto {
  @IsOptional()
  @IsISO8601()
  checkinAt?: string;

  @IsOptional()
  @IsISO8601()
  checkoutAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  checkoutRemarks?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  checkoutLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  checkoutLongitude?: number;
}

export class AttendanceQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([...ATTENDANCE_STATUS])
  status?: (typeof ATTENDANCE_STATUS)[number];

  @IsOptional()
  @IsIn([...ATTENDANCE_SOURCE])
  source?: (typeof ATTENDANCE_SOURCE)[number];

  @IsOptional()
  @IsUUID()
  userId?: string;

  /** Inclusive BS date range (`YYYY-MM-DD`) for filtering. */
  @IsOptional()
  @IsString()
  fromBs?: string;

  @IsOptional()
  @IsString()
  toBs?: string;
}

export class AttendanceReportQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['mine', 'team', 'all'])
  scope?: 'mine' | 'team' | 'all';

  @IsOptional()
  @IsString()
  bsDate?: string;

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
