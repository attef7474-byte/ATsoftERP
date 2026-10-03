import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMachinePartDto {
  @ApiPropertyOptional({ example: 'PART-001' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Hydraulic Pump' })
  @IsString()
  name: string;

  // R4N: canonical technical catalog item this part-list entry represents.
  // Optional and nullable; only set when technical identity is verified.
  @ApiPropertyOptional({ description: 'Canonical SparePart this entry represents' })
  @IsOptional()
  @IsString()
  sparePartId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partNumber?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minStock?: number;

  @ApiProperty({ example: 'pcs' })
  @IsString()
  unit: string;
}
