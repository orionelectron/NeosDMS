import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { LEAVE_REQUEST_STATUS } from '../hr.constants';

export class BsDateDto {
  @IsInt()
  @Min(2080)
  @Max(2100)
  bsYear: number;

  @IsInt()
  @Min(1)
  @Max(12)
  bsMonth: number;

  @IsInt()
  @Min(1)
  @Max(32)
  bsDay: number;
}

export class CreateLeaveRequestDto {
  @IsUUID()
  leaveTypeId: string;

  @ValidateNested()
  @Type(() => BsDateDto)
  from: BsDateDto;

  @ValidateNested()
  @Type(() => BsDateDto)
  to: BsDateDto;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReviewLeaveDto {
  @IsString()
  note?: string;
}

export class LeaveListQueryDto {
  @IsOptional()
  @IsIn(['mine', 'team', 'all'])
  scope?: 'mine' | 'team' | 'all';

  @IsOptional()
  @IsIn([...LEAVE_REQUEST_STATUS])
  status?: (typeof LEAVE_REQUEST_STATUS)[number];

  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class LeaveBalanceQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsInt()
  @Min(2080)
  @Max(2100)
  bsYear?: number;
}
