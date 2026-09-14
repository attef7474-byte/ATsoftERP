import { IsOverheadAmount } from './overhead-amount.validator';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import { COST_PURPOSE_VALUES } from '../../../../common/cost-purpose/cost-purpose.constants';
import { OVERHEAD_CATEGORIES, OVERHEAD_ENTRY_STATUSES } from '../operational-overhead.constants';

export class CreateOverheadEntryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  periodId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reference!: string;

  @IsIn(OVERHEAD_CATEGORIES)
  @IsNotEmpty()
  overheadCategory!: string;

  @IsIn(COST_PURPOSE_VALUES)
  @IsNotEmpty()
  costPurpose!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @IsOverheadAmount()
  amount!: number | string;

  @IsDateString()
  @IsNotEmpty()
  incurredAt!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  sourceCostCenterId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalDocumentReference?: string;
}

export class UpdateOverheadEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsOptional()
  @IsIn(OVERHEAD_CATEGORIES)
  overheadCategory?: string;

  @IsOptional()
  @IsIn(COST_PURPOSE_VALUES)
  costPurpose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsOverheadAmount()
  amount?: number | string;

  @IsOptional()
  @IsDateString()
  incurredAt?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  sourceCostCenterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalDocumentReference?: string;
}

export class FinalizeOverheadEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class OverheadEntryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  periodId?: string;

  @IsOptional()
  @IsIn(OVERHEAD_CATEGORIES)
  overheadCategory?: string;

  @IsOptional()
  @IsIn(COST_PURPOSE_VALUES)
  costPurpose?: string;

  @IsOptional()
  @IsIn(OVERHEAD_ENTRY_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  sourceCostCenterId?: string;
}
