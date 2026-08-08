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
import { COST_SNAPSHOT_STATUSES, COST_TYPES, COST_UNITS } from '../production-cost.constants';

export class CreateCostSnapshotDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code!: string;

  @IsUUID()
  @IsNotEmpty()
  productionProductDefinitionId!: string;

  @IsOptional()
  @IsUUID()
  productionVersionId?: string;

  @IsOptional()
  @IsUUID()
  productionPackagingId?: string;

  @IsOptional()
  @IsUUID()
  productionLineId?: string;

  @IsOptional()
  @IsUUID()
  machineId?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsIn(COST_TYPES)
  @IsNotEmpty()
  costType!: string;

  @IsIn(COST_UNITS)
  @IsNotEmpty()
  unit!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  rate!: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  @IsDateString()
  @IsNotEmpty()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateCostSnapshotDto {
  @IsOptional()
  @IsIn(COST_UNITS)
  unit?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  rate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CostSnapshotQueryDto {
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
  @IsIn(COST_SNAPSHOT_STATUSES)
  status?: string;

  @IsOptional()
  @IsUUID()
  productionProductDefinitionId?: string;
}

export class FreezeCostSnapshotDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class SupersedeCostSnapshotDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
