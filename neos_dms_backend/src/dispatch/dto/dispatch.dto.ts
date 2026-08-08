import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { DISPATCH_STATUSES, FAILURE_REASONS } from '../dispatch.constants';

export class CreateDispatchDto {
  /** Eligible CONFIRMED/COMPLETED orders to allocate (one stop each). */
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  orderIds: string[];

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsUUID()
  routeId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  sourceInventoryLocationId?: string;

  @IsOptional()
  @IsDateString()
  plannedDepartureAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDispatchDto {
  /** Reassignment allowed while the dispatch is ALLOCATED. */
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsUUID()
  routeId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  sourceInventoryLocationId?: string;

  @IsOptional()
  @IsDateString()
  plannedDepartureAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class DispatchQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(DISPATCH_STATUSES)
  status?: (typeof DISPATCH_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}

export class DeliverStopLineDto {
  @IsUUID()
  orderLineId: string;

  /** Delivered quantity in the order line's sell uom. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(999999999999.999)
  deliveredQuantity?: number;

  /** Returned quantity in the order line's sell uom. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(999999999999.999)
  returnedQuantity?: number;
}

class PodFields {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  podReceiverName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  podSignaturePhotoKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  podGpsLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  podGpsLongitude?: number;
}

export class DeliverStopDto extends PodFields {
  /** Client-generated idempotency key for queued/offline sync (decision 26). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deliveryEventId?: string;

  /** One line per allocated order line; must cover exactly the stop's lines. */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DeliverStopLineDto)
  lines: DeliverStopLineDto[];

  @IsOptional()
  @IsString()
  podNotes?: string;
}

export class FailStopDto extends PodFields {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deliveryEventId?: string;

  @IsIn(FAILURE_REASONS)
  failureReason: (typeof FAILURE_REASONS)[number];

  @IsNotEmpty()
  @IsString()
  podNotes?: string;
}
