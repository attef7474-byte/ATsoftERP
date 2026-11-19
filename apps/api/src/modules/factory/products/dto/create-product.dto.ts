import { IsString, IsOptional, IsNumber, Min, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductUomInputDto } from './product-uom.dto';
import { UnifiedProductionConfigDto } from './unified-production-config.dto';
import { PRODUCT_ITEM_TYPES } from '../product-item-type.domain';

export class CreateProductDto {
  @ApiPropertyOptional({ example: 'RM001' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Steel Plate 10mm' })
  @IsString()
  name: string;

  @ApiProperty({ enum: PRODUCT_ITEM_TYPES, description: 'Canonical business item type. Required for every new item.' })
  @IsString()
  @IsIn([...PRODUCT_ITEM_TYPES])
  itemType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ example: 'pcs' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: 'Canonical global unit id for the product base inventory unit (preferred over unit)' })
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional({ type: [ProductUomInputDto], description: 'Additional packaging units; base unit is implied by unitId/unit' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductUomInputDto)
  uoms?: ProductUomInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxStock?: number;

  @ApiPropertyOptional({
    type: UnifiedProductionConfigDto,
    description: 'Optional production configuration for the same product. Presence requires the production-product permission for the action.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UnifiedProductionConfigDto)
  production?: UnifiedProductionConfigDto;
}
