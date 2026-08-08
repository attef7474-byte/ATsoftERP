import { IsBoolean, IsDecimal, IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
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