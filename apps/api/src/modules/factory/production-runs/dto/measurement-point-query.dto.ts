import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PRODUCTION_MEASUREMENT_POINT_STATUSES, PRODUCTION_MEASUREMENT_ROLES } from '../production-runs.constants';

export class MeasurementPointQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(PRODUCTION_MEASUREMENT_POINT_STATUSES) status?: string;
  @IsOptional() @IsIn(PRODUCTION_MEASUREMENT_ROLES) role?: string;
  @IsOptional() @IsString() productionLineId?: string;
  @IsOptional() @IsString() machineId?: string;
}