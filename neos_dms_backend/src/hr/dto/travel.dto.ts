import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  EXPENSE_CLAIM_STATUS,
  EXPENSE_CATEGORY,
  TRANSPORT_MODE,
} from '../hr.constants';
import { BsDateDto } from './leave.dto';

export class CreateTravelRequestDto {
  @IsString()
  @IsNotEmpty()
  purpose: string;

  @ValidateNested()
  @Type(() => BsDateDto)
  from: BsDateDto;

  @ValidateNested()
  @Type(() => BsDateDto)
  to: BsDateDto;

  @IsIn([...TRANSPORT_MODE])
  transportMode: (typeof TRANSPORT_MODE)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedCost?: number;
}

export class UpdateTravelRequestDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  purpose?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BsDateDto)
  from?: BsDateDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BsDateDto)
  to?: BsDateDto;

  @IsOptional()
  @IsIn([...TRANSPORT_MODE])
  transportMode?: (typeof TRANSPORT_MODE)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedCost?: number;
}

export class ReviewTravelDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateExpenseClaimDto {
  @IsOptional()
  @IsUUID()
  travelRequestId?: string;

  @ValidateNested()
  @Type(() => BsDateDto)
  from: BsDateDto;

  @ValidateNested()
  @Type(() => BsDateDto)
  to: BsDateDto;
}

export class CreateExpenseItemDto {
  @ValidateNested()
  @Type(() => BsDateDto)
  bsDate: BsDateDto;

  @IsIn([...EXPENSE_CATEGORY])
  category: (typeof EXPENSE_CATEGORY)[number];

  @IsString()
  @IsNotEmpty()
  description: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  receiptKey?: string;
}

export class UpdateExpenseItemDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => BsDateDto)
  bsDate?: BsDateDto;

  @IsOptional()
  @IsIn([...EXPENSE_CATEGORY])
  category?: (typeof EXPENSE_CATEGORY)[number];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  receiptKey?: string;
}

export class ApprovedItemDto {
  @IsUUID()
  id: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  approvedAmount: number;
}

export class PayExpenseClaimDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ApprovedItemDto)
  items?: ApprovedItemDto[];
}

export class ExpenseClaimQueryDto {
  @IsOptional()
  @IsIn([...EXPENSE_CLAIM_STATUS])
  status?: (typeof EXPENSE_CLAIM_STATUS)[number];

  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class TravelRequestQueryDto {
  @IsOptional()
  @IsIn(['mine', 'team', 'all'])
  scope?: 'mine' | 'team' | 'all';

  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

  @IsOptional()
  @IsUUID()
  userId?: string;
}
