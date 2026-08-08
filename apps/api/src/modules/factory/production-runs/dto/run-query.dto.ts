import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { PRODUCTION_RUN_STATUSES } from '../production-runs.constants';

export class RunQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(PRODUCTION_RUN_STATUSES) status?: string;
  @IsOptional() @IsString() productionOrderId?: string;
  @IsOptional() @IsString() productionLineId?: string;
  @IsOptional() @IsString() machineId?: string;
  @IsOptional() @IsISO8601() dateFrom?: string;
  @IsOptional() @IsISO8601() dateTo?: string;
}