import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsDecimal, IsIn, IsISO8601, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
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

/**
 * Batch (multi-select) create: one canonical DRAFT PerformanceTarget per selected target,
 * all-or-nothing. The scope type is shared across the batch; each item carries only the
 * dimension ids for that scope. Numeric target values and the effective period are shared.
 * Mirrors the capacity-standards batch contract: no auto-approval (stays DRAFT), atomic
 * Serializable transaction, per-item validation before any write.
 */
export class BatchPerformanceTargetItemDto {
  @IsOptional() @IsString() productionUnitId?: string;
  @IsOptional() @IsString() productionLineId?: string;
  @IsOptional() @IsString() machineId?: string;
  @IsOptional() @IsString() productionProductDefinitionId?: string;
}

export class BatchCreatePerformanceTargetsDto {
  @IsIn(PERFORMANCE_TARGET_SCOPE_TYPES) scopeType!: string;

  @ApiProperty({ type: [BatchPerformanceTargetItemDto], description: 'One item per selected target resource' })
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => BatchPerformanceTargetItemDto)
  targets!: BatchPerformanceTargetItemDto[];

  @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) availabilityTarget!: string;
  @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) performanceTarget!: string;
  @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) qualityTarget!: string;
  @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) oeeTarget!: string;
  @IsISO8601() effectiveFrom!: string;
  @IsOptional() @IsISO8601() effectiveTo?: string;
  @IsOptional() @IsString() @MaxLength(1000) approvalNote?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
