import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductionProductDefinitionDto {
  @ApiPropertyOptional({ description: 'Optional; auto-generated (PP-xxxxxx) when omitted' })
  @IsOptional() @IsString() code?: string;

  @ApiPropertyOptional({ description: 'Defaults to the linked inventory product name' })
  @IsOptional() @IsString() name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiProperty({ description: 'Inventory product (item master) this production product is defined for' })
  @IsString() @IsNotEmpty() productId: string;

  @ApiPropertyOptional() @IsOptional() @IsString() defaultUnitId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() defaultLineId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() defaultWarehouseId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() defaultCostCenterId?: string;
}
