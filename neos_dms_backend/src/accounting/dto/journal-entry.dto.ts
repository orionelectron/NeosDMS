import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { JOURNAL_STATUS } from '../accounting.constants';

export class JournalLineDto {
  @IsUUID()
  accountId: string;

  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  debit?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  credit?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateJournalEntryDto {
  @IsUUID()
  branchId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'entryDate must be in YYYY-MM-DD format',
  })
  entryDate: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines: JournalLineDto[];
}

export class JournalListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(JOURNAL_STATUS)
  status?: (typeof JOURNAL_STATUS)[number];

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from must be in YYYY-MM-DD format',
  })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to must be in YYYY-MM-DD format',
  })
  to?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;
}
