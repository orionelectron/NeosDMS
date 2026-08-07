import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateLeaveTypeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(730)
  daysPerYear?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  carryoverLimitDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  maxConsecutiveDays?: number;

  @IsOptional()
  @IsBoolean()
  requiresBalance?: boolean;
}

export class UpdateLeaveTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(730)
  daysPerYear?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  carryoverLimitDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  maxConsecutiveDays?: number;

  @IsOptional()
  @IsBoolean()
  requiresBalance?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateLeaveBalanceDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  leaveTypeId: string;

  @IsInt()
  @Min(2080)
  @Max(2100)
  bsYear: number;

  @IsOptional()
  @Type(() => Number)
  entitledDays?: number;

  @IsOptional()
  @Type(() => Number)
  carryoverDays?: number;
}
