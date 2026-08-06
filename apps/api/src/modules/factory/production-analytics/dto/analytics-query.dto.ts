import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { ANALYTICS_REPORTS, ANALYTICS_LIMITS, ANALYTICS_GRAINS, LOSS_CATEGORIES } from '../production-analytics.constants';

export class PerformanceTargetQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() scopeType?: string;
  @IsOptional() @IsString() productionUnitId?: string;
  @IsOptional() @IsString() productionLineId?: string;
  @IsOptional() @IsString() machineId?: string;
  @IsOptional() @IsString() productionProductDefinitionId?: string;
}

export class AnalyticsQueryDto {
  @IsISO8601() dateFrom!: string;
  @IsISO8601() dateTo!: string;
  @IsOptional() @IsString() productionUnitId?: string;
  @IsOptional() @IsString() productionLineId?: string;
  @IsOptional() @IsString() machineId?: string;
  @IsOptional() @IsString() productionProductDefinitionId?: string;
  @IsOptional() @IsString() shiftId?: string;
  @IsOptional() @IsString() productionOrderId?: string;
  @IsOptional() @IsString() productionRunId?: string;
  @IsOptional() @IsString() reasonId?: string;
  @IsOptional() @IsIn(ANALYTICS_GRAINS) grain?: string;
  @IsOptional() @IsIn(LOSS_CATEGORIES) lossCategory?: string;
  @IsOptional() @IsIn(['PLANNED', 'UNPLANNED']) downtimeOccurrence?: string;
}

export class AnalyticsPageDto extends AnalyticsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(ANALYTICS_LIMITS.maxPageSize) limit = 20;
}

export class AnalyticsExportQueryDto extends AnalyticsQueryDto {
  @IsIn(ANALYTICS_REPORTS) report!: string;
}
