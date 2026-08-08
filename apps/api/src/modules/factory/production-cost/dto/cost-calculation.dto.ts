import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { COST_CALCULATION_SCOPE_TYPES, COST_CALCULATION_STATUSES } from '../production-cost.constants';

export class CreateCostCalculationDto {
  @IsIn(COST_CALCULATION_SCOPE_TYPES)
  @IsNotEmpty()
  scopeType!: string;

  @IsUUID()
  @IsNotEmpty()
  scopeId!: string;

  @IsDateString()
  @IsNotEmpty()
  periodFrom!: string;

  @IsDateString()
  @IsNotEmpty()
  periodTo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ReviewCostCalculationDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class FinalizeCostCalculationDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class ReopenCostCalculationDto {
  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @IsOptional()
  @IsDateString()
  periodTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class AttachTransactionToCalculationDto {
  @IsUUID()
  @IsNotEmpty()
  transactionId!: string;
}

export class CostCalculationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsIn(COST_CALCULATION_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(COST_CALCULATION_SCOPE_TYPES)
  scopeType?: string;

  @IsOptional()
  @IsUUID()
  productionOrderId?: string;

  @IsOptional()
  @IsUUID()
  productionRunId?: string;

  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @IsOptional()
  @IsDateString()
  periodTo?: string;
}
