import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const PURPOSES = [
  'GENERAL_LOOKUP', 'INVENTORY_COUNTING', 'INVENTORY_MOVEMENT', 'INVENTORY_ADJUSTMENT',
  'MAINTENANCE_LOOKUP', 'MAINTENANCE_REQUEST', 'MAINTENANCE_TASK', 'DOWNTIME',
  'MACHINE_CHECK', 'PART_LOOKUP',
] as const;

const SOURCES = ['WEB', 'MOBILE', 'TABLET', 'API', 'HANDHELD_SCANNER', 'UNKNOWN'] as const;

export class ScanBarcodeDto {
  @ApiProperty()
  @IsString()
  value: string;

  @ApiPropertyOptional({ enum: PURPOSES, default: 'GENERAL_LOOKUP' })
  @IsOptional()
  @IsString()
  @IsIn(PURPOSES)
  purpose?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contextType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contextId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ enum: SOURCES, default: 'WEB' })
  @IsOptional()
  @IsString()
  @IsIn(SOURCES)
  source?: string;
}
