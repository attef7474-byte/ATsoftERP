import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

const STATUSES = ['DRAFT','ACTIVE','INACTIVE','SUPERSEDED'] as const;
const MODES = ['LINEAR_TARGET','LINEAR_RANGE','THRESHOLD_BANDS','CAPPED_RATIO','TARGET_BAND','INVERSE_LINEAR'] as const;
const DIRS = ['HIGHER_IS_BETTER','LOWER_IS_BETTER','TARGET_IS_BEST','INFORMATIONAL'] as const;

export class CreatePerformanceTargetDto {
  @IsString() kpiDefinitionId!: string;
  @IsOptional() @IsString() performanceProfileId?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() productionLineId?: string;
  @IsOptional() @IsString() machineId?: string;
  @IsOptional() @IsString() productionProductDefinitionId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() jobTitleId?: string;
  @IsString() scopeType!: string;
  @Type(() => Number) @IsNumber() targetValue!: number;
  @IsOptional() @Type(() => Number) @IsNumber() minimumAcceptableValue?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maximumExceptionalValue?: number;
  @IsOptional() @IsString() @MaxLength(30) unit?: string;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class UpdatePerformanceTargetDto {
  @IsOptional() @IsString() scopeType?: string;
  @IsOptional() @Type(() => Number) @IsNumber() targetValue?: number;
  @IsOptional() @Type(() => Number) @IsNumber() minimumAcceptableValue?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maximumExceptionalValue?: number;
  @IsOptional() @IsString() @MaxLength(30) unit?: string;
  @IsOptional() @IsDateString() effectiveFrom?: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class CreatePerformanceWeightDto {
  @IsString() performanceProfileId!: string;
  @IsString() kpiDefinitionId!: string;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) weightPercent!: number;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsBoolean() isInformational?: boolean;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class UpdatePerformanceWeightDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) weightPercent?: number;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsBoolean() isInformational?: boolean;
  @IsOptional() @IsDateString() effectiveFrom?: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class CreatePerformanceScoringRuleDto {
  @IsString() kpiDefinitionId!: string;
  @IsOptional() @IsString() performanceProfileId?: string;
  @IsIn(MODES as any) scoringMode!: string;
  @IsIn(DIRS as any) direction!: string;
  @IsOptional() @Type(() => Number) @IsNumber() minScore?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maxScore?: number;
  @IsOptional() @Type(() => Number) @IsNumber() targetScore?: number;
  @IsOptional() @Type(() => Number) @IsNumber() floorValue?: number;
  @IsOptional() @Type(() => Number) @IsNumber() targetValue?: number;
  @IsOptional() @Type(() => Number) @IsNumber() ceilingValue?: number;
  @IsOptional() @IsString() bandsJson?: string;
  @IsOptional() @IsString() missingDataPolicy?: string;
  @IsOptional() @IsString() notApplicablePolicy?: string;
  @IsOptional() @IsString() configMissingPolicy?: string;
  @IsOptional() @Type(() => Number) @IsNumber() clampMin?: number;
  @IsOptional() @Type(() => Number) @IsNumber() clampMax?: number;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class UpdatePerformanceScoringRuleDto {
  @IsOptional() @IsIn(MODES as any) scoringMode?: string;
  @IsOptional() @IsIn(DIRS as any) direction?: string;
  @IsOptional() @Type(() => Number) @IsNumber() minScore?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maxScore?: number;
  @IsOptional() @Type(() => Number) @IsNumber() targetScore?: number;
  @IsOptional() @Type(() => Number) @IsNumber() floorValue?: number;
  @IsOptional() @Type(() => Number) @IsNumber() targetValue?: number;
  @IsOptional() @Type(() => Number) @IsNumber() ceilingValue?: number;
  @IsOptional() @IsString() bandsJson?: string;
  @IsOptional() @Type(() => Number) @IsNumber() clampMin?: number;
  @IsOptional() @Type(() => Number) @IsNumber() clampMax?: number;
  @IsOptional() @IsDateString() effectiveFrom?: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class SimulatePerformanceDto {
  @IsString() operationalPersonId!: string;
  @IsDateString() dateFrom!: string;
  @IsDateString() dateTo!: string;
}
