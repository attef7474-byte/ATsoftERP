import { IsOptional, IsString, IsNumber, Min, Max, IsBooleanString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

const RELIABILITY_STATUSES = ['ACTIVE', 'REMOVED', 'REPLACED', 'FAILED', 'RETIRED', 'DECOMMISSIONED'];
const LIFE_STATUSES = ['UNKNOWN', 'NORMAL', 'WARNING', 'DUE', 'EXPIRED'];

export class QueryInstalledPartReliabilityDto {
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

  @ApiPropertyOptional({ enum: RELIABILITY_STATUSES })
  @IsOptional()
  @IsIn(RELIABILITY_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: LIFE_STATUSES })
  @IsOptional()
  @IsIn(LIFE_STATUSES)
  lifeStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  isCritical?: string;

  @ApiPropertyOptional({ description: 'Only populations with at least one premature failure' })
  @IsOptional()
  @IsBooleanString()
  onlyEarlyFailure?: string;

  @ApiPropertyOptional({ description: 'Only populations whose current part is at/over the warning band' })
  @IsOptional()
  @IsBooleanString()
  onlyApproachingEol?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateTo?: string;
}
