import { IsString, IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

const PURPOSES = [
  'GENERAL_LOOKUP', 'INVENTORY_COUNTING', 'INVENTORY_MOVEMENT', 'INVENTORY_ADJUSTMENT',
  'MAINTENANCE_LOOKUP', 'MAINTENANCE_REQUEST', 'MAINTENANCE_TASK', 'DOWNTIME',
  'MACHINE_CHECK', 'PART_LOOKUP',
] as const;

const RESULTS = ['SUCCESS', 'NOT_FOUND', 'INACTIVE_LABEL', 'RETIRED_LABEL', 'VOID_LABEL', 'WRONG_CONTEXT', 'PERMISSION_DENIED', 'VALIDATION_ERROR', 'ERROR'] as const;

export class BarcodeScanQueryDto {
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

  @ApiPropertyOptional({ enum: PURPOSES })
  @IsOptional()
  @IsString()
  @IsIn(PURPOSES)
  purpose?: string;

  @ApiPropertyOptional({ enum: RESULTS })
  @IsOptional()
  @IsString()
  @IsIn(RESULTS)
  result?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scannedValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;
}
