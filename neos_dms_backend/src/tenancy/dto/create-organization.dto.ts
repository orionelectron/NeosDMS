import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { PLAN_PROFILES } from '../../subscription/plan-profiles';

export const BILLING_PERIOD_NAMES = ['Monthly', 'Quarterly', 'Yearly'] as const;

const PLAN_CODES = PLAN_PROFILES.map((plan) => plan.code);

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  panNumber: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  branchCode?: string;

  @IsOptional()
  @IsString()
  branchLocation?: string;

  @IsOptional()
  @IsIn(PLAN_CODES)
  planCode?: string;

  @IsOptional()
  @IsIn(BILLING_PERIOD_NAMES)
  periodName?: string;
}
