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
import { OVERHEAD_PERIOD_STATUSES } from '../operational-overhead.constants';

export class CreateOverheadPeriodDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code!: string;

  @IsDateString()
  @IsNotEmpty()
  periodFrom!: string;

  @IsDateString()
  @IsNotEmpty()
  periodTo!: string;
}

export class UpdateOverheadPeriodDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  code?: string;

  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @IsOptional()
  @IsDateString()
  periodTo?: string;
}

export class OpenOverheadPeriodDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CloseOverheadPeriodDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class OverheadPeriodQueryDto {
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
  @IsIn(OVERHEAD_PERIOD_STATUSES)
  status?: string;
}
