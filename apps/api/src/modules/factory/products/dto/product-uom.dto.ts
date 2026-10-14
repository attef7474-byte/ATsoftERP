import { IsString, IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * A single usable/packaging unit of a Product. The base inventory unit is
 * represented by exactly one row with `isBase` true (or implied by the product's
 * base unit). Every other row references a parent unit in the same product.
 */
export class ProductUomInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBase?: boolean;

  @ApiPropertyOptional({ description: 'Parent unit within the same product (unitId)' })
  @IsOptional()
  @IsString()
  parentUnitId?: string;

  @ApiPropertyOptional({ description: 'Parent packaging row id (existing rows on update)' })
  @IsOptional()
  @IsString()
  parentProductUomId?: string;

  @ApiPropertyOptional({ description: 'How many base-resolved parent units one of this unit contains' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantityPerParent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
