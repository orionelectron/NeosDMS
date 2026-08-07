import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateUomConversionDto {
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsUUID()
  fromUomId: string;

  @IsUUID()
  toUomId: string;

  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  conversionFactor: number;
}

export class UomConversionListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  itemId?: string;
}
