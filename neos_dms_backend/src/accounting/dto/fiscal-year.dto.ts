import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateFiscalYearDto {
  @IsInt()
  bsYear: number;

  @IsOptional()
  @IsString()
  name?: string;
}
