import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CAPACITY_OUTPUT_UNITS, CAPACITY_STATUSES, CAPACITY_TIME_BASES } from '../production-capacity.constants';

export class ProductionCapacityStandardQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(CAPACITY_STATUSES) status?: string;
  @IsOptional() @IsString() productionProductId?: string;
  @IsOptional() @IsString() productionLineId?: string;
  @IsOptional() @IsString() machineId?: string;
  @IsOptional() @IsIn(CAPACITY_OUTPUT_UNITS) outputUnit?: string;
  @IsOptional() @IsIn(CAPACITY_TIME_BASES) timeBasis?: string;
}
