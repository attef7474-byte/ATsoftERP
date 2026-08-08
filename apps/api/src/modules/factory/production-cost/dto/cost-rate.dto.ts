import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { COST_RATE_STATUSES, COST_TYPES, COST_UNITS } from '../production-cost.constants';

export class CreateCostRateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameAr!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameEn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsIn(COST_TYPES)
  @IsNotEmpty()
  costType!: string;

  @IsIn(COST_UNITS)
  @IsNotEmpty()
  unit!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  rate!: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  @IsOptional()
  @IsUUID()
  productionLineId?: string;

  @IsOptional()
  @IsUUID()
  machineId?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsDateString()
  @IsNotEmpty()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class UpdateCostRateDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(COST_TYPES)
  costType?: string;

  @IsOptional()
  @IsIn(COST_UNITS)
  unit?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  rate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  @IsOptional()
  @IsUUID()
  productionLineId?: string;

  @IsOptional()
  @IsUUID()
  machineId?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsIn(COST_RATE_STATUSES)
  status?: string;
}

export class CostRateQueryDto {
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
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(COST_TYPES)
  costType?: string;

  @IsOptional()
  @IsIn(COST_RATE_STATUSES)
  status?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;
}
