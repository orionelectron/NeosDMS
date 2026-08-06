import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { BILLING_PERIOD_NAMES } from '../../tenancy/dto/create-organization.dto';
import { PLAN_PROFILES } from '../plan-profiles';

const PLAN_CODES = PLAN_PROFILES.map((plan) => plan.code);

export class ChangePlanDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(PLAN_CODES)
  planCode: string;

  @IsIn(BILLING_PERIOD_NAMES)
  periodName: string;
}
