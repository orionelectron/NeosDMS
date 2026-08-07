import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { COA_TYPE } from '../accounting.constants';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateAccountDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsIn(COA_TYPE)
  coaType: (typeof COA_TYPE)[number];

  @IsOptional()
  @IsUUID()
  parentAccountId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsBoolean()
  isGroup?: boolean;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  parentAccountId?: string | null;

  @IsOptional()
  @IsBoolean()
  isGroup?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AccountListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsIn(COA_TYPE)
  coaType?: (typeof COA_TYPE)[number];

  @IsOptional()
  @IsString()
  search?: string;
}
