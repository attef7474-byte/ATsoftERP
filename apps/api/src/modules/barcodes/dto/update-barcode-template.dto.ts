import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const SYMBOLOGIES = ['QR_CODE', 'CODE128', 'DATA_MATRIX', 'EAN13'] as const;
const ENTITY_TYPES = [
  'MACHINE', 'MACHINE_PART', 'PRODUCT', 'WAREHOUSE', 'WAREHOUSE_LOCATION',
  'INVENTORY_COUNT', 'INVENTORY_COUNT_LINE', 'INVENTORY_MOVEMENT', 'INVENTORY_ADJUSTMENT',
  'MAINTENANCE_REQUEST', 'MAINTENANCE_TASK', 'MAINTENANCE_SCHEDULE', 'MAINTENANCE_CHECKLIST_ITEM',
  'DOWNTIME_LOG',
] as const;

export class UpdateBarcodeTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: SYMBOLOGIES })
  @IsOptional()
  @IsString()
  @IsIn(SYMBOLOGIES)
  symbology?: string;

  @ApiPropertyOptional({ enum: ENTITY_TYPES })
  @IsOptional()
  @IsString()
  @IsIn(ENTITY_TYPES)
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateData?: string;
}
