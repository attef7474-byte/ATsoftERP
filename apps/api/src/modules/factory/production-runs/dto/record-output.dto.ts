import { IsDecimal, IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class RecordOutputDto {
  @IsUUID() requestId!: string;
  @IsString() measurementPointId!: string;
  @IsIn(['PRODUCTION', 'RESET'] as const) eventType!: 'PRODUCTION' | 'RESET';
  @IsOptional() @IsISO8601() occurredAt?: string;
  @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) quantity?: string;
  @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) goodQuantity?: string;
  @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) rejectQuantity?: string;
  @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) rawCount?: string;
  @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) resetValue?: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}