import { IsOptional, IsString, IsNumber, Min, Max, IsBooleanString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export const RELIABILITY_ALERT_TYPES = [
  'LIFE_APPROACHING_DUE',
  'LIFE_DUE',
  'LIFE_OVERDUE',
  'REPEATED_PREMATURE_FAILURE',
  'HIGH_REPLACEMENT_FREQUENCY',
];

export const RELIABILITY_ALERT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const RELIABILITY_ALERT_DUE_STATES = ['NORMAL', 'WARNING', 'DUE', 'EXPIRED', 'N/A'];

export class QueryReliabilityAlertsDto {
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
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ enum: RELIABILITY_ALERT_TYPES })
  @IsOptional()
  @IsIn(RELIABILITY_ALERT_TYPES)
  alertType?: string;

  @ApiPropertyOptional({ enum: RELIABILITY_ALERT_SEVERITIES })
  @IsOptional()
  @IsIn(RELIABILITY_ALERT_SEVERITIES)
  severity?: string;

  @ApiPropertyOptional({ enum: RELIABILITY_ALERT_DUE_STATES })
  @IsOptional()
  @IsIn(RELIABILITY_ALERT_DUE_STATES)
  dueState?: string;

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
  productionLineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  isCritical?: string;

  @ApiPropertyOptional({ description: 'Free-text search over machine/component/spare-part code or name' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class PlanningCandidateQueryDto {
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

  @ApiPropertyOptional({ enum: RELIABILITY_ALERT_TYPES })
  @IsOptional()
  @IsIn(RELIABILITY_ALERT_TYPES)
  alertType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  installedPartId?: string;
}
