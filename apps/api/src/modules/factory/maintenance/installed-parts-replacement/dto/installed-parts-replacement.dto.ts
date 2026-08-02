import { IsString, IsNumber, IsOptional, Min, IsBooleanString, IsIn, IsBoolean, Max, IsDateString, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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
