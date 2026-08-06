import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CreateOrganizationDto } from '../../tenancy/dto/create-organization.dto';

export class RegisterOwnerDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class RegisterDto extends CreateOrganizationDto {
  @ValidateNested()
  @Type(() => RegisterOwnerDto)
  owner: RegisterOwnerDto;
}
