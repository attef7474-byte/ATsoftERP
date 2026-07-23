import { IsString, IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSparePartDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() category?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() specification?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() unit?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() manufacturer?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() model?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() partNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() barcode?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) minRecommendedStock?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) maxRecommendedStock?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) reorderPoint?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isCritical?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() productId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
}

export class UpdateSparePartDto {
  @ApiPropertyOptional() @IsString() @IsOptional() code?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() category?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() specification?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() unit?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() manufacturer?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() model?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() partNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() barcode?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) minRecommendedStock?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) maxRecommendedStock?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) reorderPoint?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isCritical?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() productId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
}
