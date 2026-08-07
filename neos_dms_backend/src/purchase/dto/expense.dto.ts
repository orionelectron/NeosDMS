import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { EXPENSE_MODES, EXPENSE_STATUSES } from '../purchase.constants';

export class ExpenseLineDto {
  /** The COA account charged — must have `EXPENSE` coaType (validated at POST). */
  @IsUUID()
  expenseAccountId: string;

  @IsString()
  description: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(999999999999.999)
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitAmount: number;

  /** Per-line discount percent (0–100), netted into the expense account DR. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  discountPercent?: number;

  /** Overrides the org's input-VAT default for this line. */
  @IsOptional()
  @IsUUID()
  taxCodeId?: string;

  /** Per-line TDS withholding code (decision 43) — must be a TDS_WITHHOLDING code. */
  @IsOptional()
  @IsUUID()
  tdsTaxCodeId?: string;
}

export class CreateExpenseDto {
  /** `CASH` — CR the payment account; `CREDIT` — CR AP 2101 with the party. */
  @IsIn(EXPENSE_MODES)
  expenseMode: (typeof EXPENSE_MODES)[number];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseLineDto)
  lines: ExpenseLineDto[];

  /** Required when `expenseMode === 'CREDIT'` — the vendor the cost is on credit for. */
  @IsOptional()
  @IsUUID()
  partyId?: string;

  /** Required when `expenseMode === 'CASH'` — the cash/bank account money leaves. */
  @IsOptional()
  @IsUUID()
  paymentAccountId?: string;

  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateExpenseDto {
  /** Switching modes is allowed on a draft; the party/payment-account rule re-applies. */
  @IsOptional()
  @IsIn(EXPENSE_MODES)
  expenseMode?: (typeof EXPENSE_MODES)[number];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseLineDto)
  lines?: ExpenseLineDto[];

  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsUUID()
  paymentAccountId?: string;

  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ExpenseQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(EXPENSE_STATUSES)
  status?: (typeof EXPENSE_STATUSES)[number];

  @IsOptional()
  @IsIn(EXPENSE_MODES)
  expenseMode?: (typeof EXPENSE_MODES)[number];

  @IsOptional()
  @IsUUID()
  partyId?: string;
}
