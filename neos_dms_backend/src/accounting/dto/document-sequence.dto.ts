import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateDocumentSequenceDto {
  @IsString()
  documentType: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  fiscalYearId?: string;

  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lastNumber?: number;
}
