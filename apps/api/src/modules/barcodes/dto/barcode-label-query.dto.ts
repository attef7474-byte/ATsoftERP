import { IsString, IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

const ENTITY_TYPES = [
  'MACHINE', 'MACHINE_PART', 'PRODUCT', 'WAREHOUSE', 'WAREHOUSE_LOCATION',
  'INVENTORY_COUNT', 'INVENTORY_COUNT_LINE', 'INVENTORY_MOVEMENT', 'INVENTORY_ADJUSTMENT',
  'MAINTENANCE_REQUEST', 'MAINTENANCE_TASK', 'MAINTENANCE_SCHEDULE', 'MAINTENANCE_CHECKLIST_ITEM',
  'DOWNTIME_LOG',
] as const;

const STATUSES = ['ACTIVE', 'INACTIVE', 'RETIRED', 'VOID'] as const;
const SYMBOLOGIES = ['QR_CODE', 'CODE128', 'DATA_MATRIX', 'EAN13'] as const;

export class BarcodeLabelQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ENTITY_TYPES })
  @IsOptional()
  @IsString()
  @IsIn(ENTITY_TYPES)
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsString()
  @IsIn(STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: SYMBOLOGIES })
  @IsOptional()
  @IsString()
  @IsIn(SYMBOLOGIES)
  symbology?: string;
}
