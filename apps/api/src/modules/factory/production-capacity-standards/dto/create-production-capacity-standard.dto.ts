import { IsArray, ArrayMaxSize, ArrayNotEmpty, IsDecimal, IsIn, IsISO8601, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

/**
 * Per-target override for a batch capacity-standard create. Only capability-dependent
 * numeric fields may differ between targets; identity/reference fields stay shared so the
 * batch keeps one canonical product/version/packaging/unit basis.
 */
export class CapacityBatchTargetOverrideDto {
  @ApiProperty({ description: 'Machine id (scope MACHINE) or production-line id (scope LINE)' })
  @IsString() targetId!: string;

  @ApiPropertyOptional() @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) standardRate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) standardCycleTimeMinutes?: string;
  @ApiPropertyOptional() @IsOptional() @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) setupMinutes?: string;
  @ApiPropertyOptional() @IsOptional() @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) changeoverMinutes?: string;
  @ApiPropertyOptional() @IsOptional() @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) cleaningMinutes?: string;
  @ApiPropertyOptional() @IsOptional() @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) startupAllowanceMinutes?: string;
  @ApiPropertyOptional() @IsOptional() @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) shutdownAllowanceMinutes?: string;
  @ApiPropertyOptional() @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) targetEfficiencyPercent?: string;
  @ApiPropertyOptional() @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) expectedYieldPercent?: string;
}

/**
 * Batch (multi-select) capacity-standard creation.
 *
 * Multi-select is an input convenience only: each selected line (scope LINE) or machine
 * (scope MACHINE, within one line) produces exactly one canonical DRAFT
 * ProductionCapacityStandard row. The whole request is atomic: if any target is invalid,
 * nothing is written. Batch never auto-approves; lifecycle stays "Draft" so approval-time
 * overlap protection remains the single duplicate guard (mirrors single-record create).
 */
export class BatchCreateCapacityStandardsDto {
  @ApiProperty({ enum: ['LINE', 'MACHINE'], description: 'Resource scope: one standard per selected resource' })
  @IsIn(['LINE', 'MACHINE']) scope!: 'LINE' | 'MACHINE';

  @ApiProperty({ type: [String], description: 'Production-line ids (scope LINE only)' })
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) lineIds?: string[];

  @ApiPropertyOptional({ description: 'Owning production-line id (scope MACHINE only)' })
  @IsOptional() @IsString() productionLineId?: string;

  @ApiProperty({ type: [String], description: 'Machine ids (scope MACHINE only)' })
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) machineIds?: string[];

  @ApiProperty() @IsString() productionProductId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() productionVersionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() productionPackagingId?: string;

  @ApiProperty() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) standardRate!: string;
  @ApiProperty({ enum: CAPACITY_OUTPUT_UNITS }) @IsIn(CAPACITY_OUTPUT_UNITS) outputUnit!: string;
  @ApiProperty({ enum: CAPACITY_TIME_BASES }) @IsIn(CAPACITY_TIME_BASES) timeBasis!: string;
  @ApiPropertyOptional() @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) standardCycleTimeMinutes?: string;
  @ApiPropertyOptional() @IsOptional() @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) setupMinutes?: string;
  @ApiPropertyOptional() @IsOptional() @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) changeoverMinutes?: string;
  @ApiPropertyOptional() @IsOptional() @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) cleaningMinutes?: string;
  @ApiPropertyOptional() @IsOptional() @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) startupAllowanceMinutes?: string;
  @ApiPropertyOptional() @IsOptional() @IsDecimal({ decimal_digits: '0,2', force_decimal: false }) shutdownAllowanceMinutes?: string;
  @ApiProperty() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) targetEfficiencyPercent!: string;
  @ApiProperty() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) expectedYieldPercent!: string;
  @ApiProperty({ enum: CAPACITY_SOURCE_TYPES }) @IsIn(CAPACITY_SOURCE_TYPES) sourceType!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) sourceReference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @ApiProperty() @IsISO8601() effectiveFrom!: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() effectiveTo?: string;

  @ApiPropertyOptional({ type: [CapacityBatchTargetOverrideDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => CapacityBatchTargetOverrideDto)
  overrides?: CapacityBatchTargetOverrideDto[];
}
