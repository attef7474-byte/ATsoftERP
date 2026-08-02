import { IsString, IsOptional, IsIn, IsNumber, Min, IsNotEmpty, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddWorkOrderPartDto {
  @ApiPropertyOptional({ description: 'Spare part id. productId is derived from the spare part when omitted.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sparePartId?: string;

  @ApiPropertyOptional({ description: 'Product id (inventory item). Required when sparePartId is omitted.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  productId?: string;

  @ApiProperty({ example: 1 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.0001)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 25.5 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateWorkOrderPartDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.0001)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class IssueWorkOrderPartsDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Part line ids to issue. When omitted, all PENDING lines are issued.',
  })
  @IsOptional()
  @IsArray()
  partLineIds?: string[];

  @ApiPropertyOptional({ description: 'Warehouse for the issue. Defaults to the work order warehouse.' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
