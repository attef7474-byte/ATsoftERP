import { IsDecimal, IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { CAPACITY_OUTPUT_UNITS, CAPACITY_SOURCE_TYPES, CAPACITY_TIME_BASES } from '../production-capacity.constants';

export class CreateProductionCapacityStandardDto {
  @IsString() productionProductId!: string;
  @IsOptional() @IsString() productionVersionId?: string;
  @IsOptional() @IsString() productionPackagingId?: string;
  @IsString() productionLineId!: string;
  @IsOptional() @IsString() machineId?: string;

  @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) standardRate!: string;
  @IsIn(CAPACITY_OUTPUT_UNITS) outputUnit!: string;
  @IsIn(CAPACITY_TIME_BASES) timeBasis!: string;
  @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) standardCycleTimeMinutes?: string;
  @IsOptional() @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) setupMinutes?: string;
  @IsOptional() @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) changeoverMinutes?: string;
  @IsOptional() @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) cleaningMinutes?: string;
  @IsOptional() @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) startupAllowanceMinutes?: string;
  @IsOptional() @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) shutdownAllowanceMinutes?: string;
  @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) targetEfficiencyPercent!: string;
  @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) expectedYieldPercent!: string;
  @IsIn(CAPACITY_SOURCE_TYPES) sourceType!: string;
  @IsOptional() @IsString() @MaxLength(1000) sourceReference?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsISO8601() effectiveFrom!: string;
  @IsOptional() @IsISO8601() effectiveTo?: string;
}
