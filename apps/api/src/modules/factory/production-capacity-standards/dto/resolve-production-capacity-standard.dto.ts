import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';
import { CAPACITY_OUTPUT_UNITS, CAPACITY_TIME_BASES } from '../production-capacity.constants';

export class ResolveProductionCapacityStandardDto {
  @IsString() productionProductId!: string;
  @IsOptional() @IsString() productionVersionId?: string;
  @IsOptional() @IsString() productionPackagingId?: string;
  @IsString() productionLineId!: string;
  @IsOptional() @IsString() machineId?: string;
  @IsIn(CAPACITY_OUTPUT_UNITS) outputUnit!: string;
  @IsIn(CAPACITY_TIME_BASES) timeBasis!: string;
  @IsISO8601() requestedAt!: string;
}
