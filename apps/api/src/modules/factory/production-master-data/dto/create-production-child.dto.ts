import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsInt, IsDecimal } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSpecificationDto {
  @ApiProperty() @IsString() @IsNotEmpty() attributeName: string;

  @ApiProperty() @IsString() attributeValue: string;

  @ApiPropertyOptional({ default: 'TEXT', description: 'TEXT | NUMBER | BOOLEAN | DATE' })
  @IsOptional() @IsString() dataType?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() unitId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean() isRequired?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsNumber() @IsInt() sortOrder?: number;
}

export class CreateVersionDto {
  @ApiPropertyOptional({ description: 'Auto-computed (max + 1) when omitted' })
  @IsOptional() @Type(() => Number) @IsNumber() @IsInt() versionNumber?: number;

  @ApiProperty() @IsString() @IsNotEmpty() versionLabel: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean() isCurrent?: boolean;
}

export class CreatePackagingDto {
  @ApiProperty({ description: 'BAG | BOX | CARTON | PALLET | DRUM | TANK | OTHER' })
  @IsString() @IsNotEmpty() packagingType: string;

  @ApiProperty({ type: String, example: '10.0000' }) @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) packQuantity: string;

  @ApiPropertyOptional() @IsOptional() @IsString() unitId?: string;

  @ApiPropertyOptional({ type: String, example: '10.5000' }) @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) grossWeight?: string;

  @ApiPropertyOptional({ type: String, example: '10.0000' }) @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) netWeight?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class CreateEligibilityDto {
  @ApiProperty({ description: 'MACHINE | LINE' })
  @IsString() @IsNotEmpty() resourceType: string;

  @ApiPropertyOptional() @IsOptional() @IsString() machineId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() productionLineId?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsNumber() @IsInt() priority?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean() isDefault?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
