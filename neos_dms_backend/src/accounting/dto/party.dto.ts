import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
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
import { PARTY_KIND } from '../accounting.constants';

export class PartyAddressDto {
  @IsString()
  addressType: string;

  @IsString()
  addressLine1: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreatePartyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsIn(PARTY_KIND)
  partyKind?: (typeof PARTY_KIND)[number];

  @IsOptional()
  @IsBoolean()
  isCustomer?: boolean;

  @IsOptional()
  @IsBoolean()
  isSupplier?: boolean;

  @IsOptional()
  @IsBoolean()
  isLead?: boolean;

  @IsOptional()
  @IsString()
  panNumber?: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingBalance?: number;

  @IsOptional()
  @IsUUID()
  paymentTermId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartyAddressDto)
  addresses?: PartyAddressDto[];
}

export class UpdatePartyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(PARTY_KIND)
  partyKind?: (typeof PARTY_KIND)[number];

  @IsOptional()
  @IsBoolean()
  isCustomer?: boolean;

  @IsOptional()
  @IsBoolean()
  isSupplier?: boolean;

  @IsOptional()
  @IsBoolean()
  isLead?: boolean;

  @IsOptional()
  @IsString()
  panNumber?: string | null;

  @IsOptional()
  @IsString()
  vatNumber?: string | null;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingBalance?: number;

  @IsOptional()
  @IsUUID()
  paymentTermId?: string | null;

  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PartyListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Matches(/^(customer|supplier|lead)$/, {
    message: 'role must be one of customer, supplier, lead',
  })
  role?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
