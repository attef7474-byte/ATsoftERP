import { IsString, IsOptional, IsIn, IsInt, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ASSIGNMENT_RESOURCE_TYPES = ['MACHINE', 'LINE', 'UNIT'] as const;

export const ASSIGNMENT_SOURCES = [
  'MANUAL',
  'BACKFILL_FROM_ORDER',
  'BACKFILL_FROM_RUN',
  'BACKFILL_FROM_LINE',
  'BACKFILL_FROM_MACHINE',
  'SYSTEM_DEFAULT',
] as const;

export class CreateOperationalCostCenterAssignmentDto {
  @ApiPropertyOptional({ example: 'OCCA-000001' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ enum: ASSIGNMENT_RESOURCE_TYPES, example: 'MACHINE' })
  @IsString()
  @IsIn(ASSIGNMENT_RESOURCE_TYPES)
  resourceType: string;

  @ApiProperty({ description: 'Resolved cost center (validated tenant-scoped).' })
  @IsString()
  costCenterId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productionLineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productionUnitId?: string;

  @ApiProperty()
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({ description: 'Lower integer = higher precedence. Equal-priority overlapping ACTIVE ranges are rejected.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ enum: ASSIGNMENT_SOURCES })
  @IsOptional()
  @IsIn(ASSIGNMENT_SOURCES)
  source?: string;

  @ApiPropertyOptional({ description: 'Required for DRAFT->ACTIVE and ACTIVE->ENDED transitions and for scope/priority overrides.' })
  @IsOptional()
  @IsString()
  reason?: string;
}
