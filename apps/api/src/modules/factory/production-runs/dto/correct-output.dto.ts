import { IsDecimal, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CorrectOutputDto {
  @IsUUID() requestId!: string;
  @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) quantity!: string;
  @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) goodQuantity?: string;
  @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) rejectQuantity?: string;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
  @IsOptional() @IsISO8601() occurredAt?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}