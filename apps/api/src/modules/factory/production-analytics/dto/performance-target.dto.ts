import { IsDecimal, IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { PERFORMANCE_TARGET_SCOPE_TYPES } from '../production-analytics.constants';

export class CreatePerformanceTargetDto {
  @IsIn(PERFORMANCE_TARGET_SCOPE_TYPES) scopeType!: string;
  @IsOptional() @IsString() productionUnitId?: string;
  @IsOptional() @IsString() productionLineId?: string;
  @IsOptional() @IsString() machineId?: string;
  @IsOptional() @IsString() productionProductDefinitionId?: string;
  @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) availabilityTarget!: string;
  @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) performanceTarget!: string;
  @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) qualityTarget!: string;
  @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) oeeTarget!: string;
  @IsISO8601() effectiveFrom!: string;
  @IsOptional() @IsISO8601() effectiveTo?: string;
  @IsOptional() @IsString() @MaxLength(1000) approvalNote?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class UpdatePerformanceTargetDto {
  @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) availabilityTarget?: string;
  @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) performanceTarget?: string;
  @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) qualityTarget?: string;
  @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) oeeTarget?: string;
  @IsOptional() @IsISO8601() effectiveFrom?: string;
  @IsOptional() @IsISO8601() effectiveTo?: string;
  @IsOptional() @IsString() @MaxLength(1000) approvalNote?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class SubmitPerformanceTargetDto {
  @IsOptional() @IsString() requestId?: string;
}

export class ApprovePerformanceTargetDto {
  @IsOptional() @IsString() requestId?: string;
  @IsOptional() @IsString() @MaxLength(1000) approvalNote?: string;
}

export class DeactivatePerformanceTargetDto {
  @IsString() @MaxLength(1000) reason!: string;
  @IsOptional() @IsString() requestId?: string;
}

export class DeletePerformanceTargetDto {
  @IsOptional() @IsString() requestId?: string;
}
