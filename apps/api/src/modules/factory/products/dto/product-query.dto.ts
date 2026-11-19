import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PRODUCT_ITEM_TYPES } from '../product-item-type.domain';

/** Server-side list / F9 lookup query for the canonical item master. */
export class ProductQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: PRODUCT_ITEM_TYPES })
  @IsOptional()
  @IsIn([...PRODUCT_ITEM_TYPES])
  itemType?: string;

  @ApiPropertyOptional({ description: 'Comma-separated list of item types, e.g. RAW_MATERIAL,PACKAGING_MATERIAL' })
  @IsOptional()
  @IsString()
  itemTypes?: string;
}
