import {
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RecordPaymentDto {
  @IsString()
  @IsNotEmpty()
  invoiceNumber: string;

  @IsNumberString()
  @MaxLength(15)
  amount: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  paymentGateway?: string;

  @IsOptional()
  @IsString()
  gatewayTransactionId?: string;

  @IsOptional()
  @IsObject()
  gatewayPayload?: Record<string, unknown>;
}

export class GatewayWebhookDto {
  @IsIn(['esewa', 'khalti', 'manual'])
  gateway: 'esewa' | 'khalti' | 'manual';

  @IsString()
  @IsNotEmpty()
  event: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
