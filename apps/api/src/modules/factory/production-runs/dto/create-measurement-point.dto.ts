import { ArrayNotEmpty, IsArray, IsBoolean, IsDecimal, IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { PRODUCTION_MEASUREMENT_ROLES, PRODUCTION_MEASUREMENT_SOURCES, PRODUCTION_OUTPUT_UNITS } from '../production-runs.constants';

export class CreateMeasurementPointDto {
  @IsOptional() @IsString() @MaxLength(100) code?: string;
  @IsString() @MaxLength(255) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsString() productionLineId!: string;
  @IsOptional() @IsString() machineId?: string;
  @IsOptional() @IsString() machineComponentId?: string;
  @IsString() productionUnitId!: string;
  @IsIn(PRODUCTION_MEASUREMENT_ROLES) role!: string;
  @IsIn(PRODUCTION_MEASUREMENT_SOURCES) source!: string;
  @IsIn(PRODUCTION_OUTPUT_UNITS) unit!: string;
  @IsOptional() @IsBoolean() isAuthoritativeFinal?: boolean;
  @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) counterModulus?: string;
  @IsOptional() @IsISO8601() effectiveFrom?: string;
  @IsOptional() @IsISO8601() effectiveTo?: string;
}

/**
 * Multi-machine batch create. Creates ONE independent ProductionMeasurementPoint row
 * per unique selected machine in a single atomic transaction. Lines stay at
 * ProductionLine scope and the unit stays ProductionUnit-scoped; each machine receives
 * its own canonical measurement point with an auto-generated tenant-scoped code.
 *
 * machineComponentId / isAuthoritativeFinal are single-machine only:
 * - a component physically belongs to exactly one machine;
 * - a ProductionLine can have at most one authoritative final-output point at a time
 *   (enforced on activation), so a multi-machine batch cannot mark several rows
 *   authoritative for the same line.
 */
export class BatchCreateMeasurementPointsDto {
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) machineIds!: string[];
  @IsString() productionLineId!: string;
  @IsString() productionUnitId!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() machineComponentId?: string;
  @IsIn(PRODUCTION_MEASUREMENT_ROLES) role!: string;
  @IsIn(PRODUCTION_MEASUREMENT_SOURCES) source!: string;
  @IsIn(PRODUCTION_OUTPUT_UNITS) unit!: string;
  @IsOptional() @IsBoolean() isAuthoritativeFinal?: boolean;
  @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) counterModulus?: string;
  @IsOptional() @IsISO8601() effectiveFrom?: string;
  @IsOptional() @IsISO8601() effectiveTo?: string;
}