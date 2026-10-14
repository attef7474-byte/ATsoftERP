import { IsString, IsNumber, IsOptional, Min, IsBooleanString, IsIn, IsBoolean, Max, IsDateString, ValidateIf, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export const INSTALLED_PART_CONDITIONS = ['NEW', 'USED_SERVICEABLE', 'USED_REPAIRABLE', 'DAMAGED_REPAIRABLE', 'DAMAGED_NOT_REPAIRABLE'] as const;
export const INSTALLED_PART_REMOVAL_STATUSES = ['REMOVED', 'REPLACED', 'FAILED', 'RETIRED', 'DECOMMISSIONED'] as const;

export class QueryInstalledPartDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineComponentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sparePartId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maintenanceRequestId?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'REMOVED', 'REPLACED', 'DECOMMISSIONED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  onlyActive?: string;

  @ApiPropertyOptional({ enum: ['UNKNOWN', 'NORMAL', 'WARNING', 'DUE', 'EXPIRED'] })
  @IsOptional()
  @IsString()
  lifeStatus?: string;
}

export class QueryInstalledPartLookupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineComponentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sparePartId?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'REMOVED', 'REPLACED', 'DECOMMISSIONED'] })
  @IsOptional()
  @IsString()
  status?: string;
}

export class QueryReplacementHistoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineComponentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maintenanceRequestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requiredPartId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class SetExpectedLifeDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  expectedLifeValue: number;

  @ApiProperty({ enum: ['DAYS', 'HOURS', 'CYCLES'] })
  @IsIn(['DAYS', 'HOURS', 'CYCLES'])
  expectedLifeUnit: string;

  @ApiPropertyOptional({ description: 'Required for DAYS unit. Start date of life tracking.' })
  @IsOptional()
  @IsDateString()
  lifeStartDate?: string;

  @ApiPropertyOptional({ description: 'Required for HOURS/CYCLES units. Counter value when tracking started.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lifeStartReading?: number;

  @ApiPropertyOptional({ description: 'Current counter reading (HOURS/CYCLES units).' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentReading?: number;

  @ApiPropertyOptional({ default: 80 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(99)
  warningThresholdPercent?: number;

  @ApiPropertyOptional({ description: 'Confirmation of the unit selection to protect against mismatched readings.' })
  @IsOptional()
  @IsBoolean()
  @ValidateIf((o) => o.lifeStartDate !== undefined)
  confirmUnit?: boolean;
}

export class RecordInstalledPartReadingDto {
  @ApiProperty({ enum: ['HOURS', 'CYCLES'] })
  @IsIn(['HOURS', 'CYCLES'])
  readingType: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  readingValue: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isReset?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Manual registration of an already-physically-installed part
 * (REGISTER_EXISTING_INSTALLATION). This is a master/state registration only:
 * it NEVER issues stock and NEVER creates an inventory movement. Product is
 * derived server-side from the canonical SparePart link, never submitted.
 */
export class RegisterInstalledPartDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  machineId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineComponentId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sparePartId: string;

  @ApiPropertyOptional({ default: 1, description: 'Number of identical units represented by this installation' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  installedQuantity?: number;

  @ApiPropertyOptional({ enum: INSTALLED_PART_CONDITIONS, default: 'NEW' })
  @IsOptional()
  @IsIn([...INSTALLED_PART_CONDITIONS])
  installedCondition?: string;

  @ApiPropertyOptional({ description: 'ISO installation date; defaults to now; may not be in the future' })
  @IsOptional()
  @IsDateString()
  installedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  batchNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ description: 'Idempotency key for the registration submission (double-submit protection)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  clientRequestId: string;
}

/**
 * Authorized removal/decommission of an installed part. State-only transition:
 * it does not move stock. Used for RETIRED/FAILED removals that are not a
 * stocked replacement (which is served by the maintenance execution flow).
 */
export class RemoveInstalledPartDto {
  @ApiPropertyOptional({ enum: INSTALLED_PART_REMOVAL_STATUSES, default: 'REMOVED' })
  @IsOptional()
  @IsIn([...INSTALLED_PART_REMOVAL_STATUSES])
  newStatus?: string;

  @ApiPropertyOptional({ enum: INSTALLED_PART_CONDITIONS })
  @IsOptional()
  @IsIn([...INSTALLED_PART_CONDITIONS])
  removedCondition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  removedQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  removedReason?: string;
}
