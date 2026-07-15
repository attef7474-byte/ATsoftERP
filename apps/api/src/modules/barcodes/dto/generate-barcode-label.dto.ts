import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const ENTITY_TYPES = [
  'MACHINE', 'MACHINE_PART', 'PRODUCT', 'WAREHOUSE', 'WAREHOUSE_LOCATION',
  'INVENTORY_COUNT', 'INVENTORY_COUNT_LINE', 'INVENTORY_MOVEMENT', 'INVENTORY_ADJUSTMENT',
  'MAINTENANCE_REQUEST', 'MAINTENANCE_TASK', 'MAINTENANCE_SCHEDULE', 'MAINTENANCE_CHECKLIST_ITEM',
  'DOWNTIME_LOG',
] as const;

const SYMBOLOGIES = ['QR_CODE', 'CODE128', 'DATA_MATRIX', 'EAN13'] as const;

export class GenerateBarcodeLabelDto {
  @ApiProperty({ enum: ENTITY_TYPES })
  @IsString()
  @IsIn(ENTITY_TYPES)
  entityType: string;

  @ApiProperty()
  @IsString()
  entityId: string;

  @ApiPropertyOptional({ enum: SYMBOLOGIES, default: 'QR_CODE' })
  @IsOptional()
  @IsString()
  @IsIn(SYMBOLOGIES)
  symbology?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;
}
