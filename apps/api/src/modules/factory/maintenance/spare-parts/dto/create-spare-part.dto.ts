import { IsString, IsOptional, IsBoolean, IsNumber, Min, Max, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EXPECTED_LIFE_UNITS, MAX_WARNING_THRESHOLD_PERCENT, MIN_WARNING_THRESHOLD_PERCENT } from '../../expected-life/expected-life.constants';

export class CreateSparePartDto {
  @ApiPropertyOptional() @IsOptional() @IsString() code?: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() category?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() specification?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() unit?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() unitId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() manufacturer?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() model?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() partNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() barcode?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) minRecommendedStock?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) maxRecommendedStock?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) reorderPoint?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isCritical?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() technicalClassification?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() usageType?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() nature?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() importance?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() productId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional({ enum: EXPECTED_LIFE_UNITS, nullable: true })
  @IsOptional() @IsIn([...EXPECTED_LIFE_UNITS]) defaultExpectedLifeUnit?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.0001) defaultExpectedLifeValue?: number | null;
  @ApiPropertyOptional({ nullable: true, minimum: MIN_WARNING_THRESHOLD_PERCENT, maximum: MAX_WARNING_THRESHOLD_PERCENT })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(MIN_WARNING_THRESHOLD_PERCENT) @Max(MAX_WARNING_THRESHOLD_PERCENT)
  defaultWarningThresholdPercent?: number | null;
}

export class UpdateSparePartDto {
  @ApiPropertyOptional() @IsString() @IsOptional() code?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() category?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() specification?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() unit?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() unitId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() manufacturer?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() model?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() partNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() barcode?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) minRecommendedStock?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) maxRecommendedStock?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) reorderPoint?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isCritical?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() technicalClassification?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() usageType?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() nature?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() importance?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() productId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional({ enum: EXPECTED_LIFE_UNITS, nullable: true })
  @IsOptional() @IsIn([...EXPECTED_LIFE_UNITS]) defaultExpectedLifeUnit?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.0001) defaultExpectedLifeValue?: number | null;
  @ApiPropertyOptional({ nullable: true, minimum: MIN_WARNING_THRESHOLD_PERCENT, maximum: MAX_WARNING_THRESHOLD_PERCENT })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(MIN_WARNING_THRESHOLD_PERCENT) @Max(MAX_WARNING_THRESHOLD_PERCENT)
  defaultWarningThresholdPercent?: number | null;
}
