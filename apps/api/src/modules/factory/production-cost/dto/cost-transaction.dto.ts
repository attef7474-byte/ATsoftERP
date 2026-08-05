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
import {
  COST_TRANSACTION_SOURCE_TYPES,
  COST_TRANSACTION_STATUSES,
  COST_TYPES,
  COST_UNITS,
} from '../production-cost.constants';

export class PostCostTransactionDto {
  @IsUUID()
  @IsNotEmpty()
  clientRequestId!: string;

  @IsIn(COST_TYPES)
  @IsNotEmpty()
  eventType!: string;

  @IsIn(COST_TRANSACTION_SOURCE_TYPES)
  @IsNotEmpty()
  sourceType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  sourceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceNumberSnapshot?: string;

  @IsOptional()
  @IsUUID()
  productionOrderId?: string;

  @IsOptional()
  @IsUUID()
  productionRunId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productCodeSnapshot?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productNameSnapshot?: string;

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
  shiftId?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsOptional()
  @IsUUID()
  standardCostSnapshotId?: string;

  @IsOptional()
  @IsUUID()
  outputEventId?: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity!: number;

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

  @IsDateString()
  @IsNotEmpty()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ReverseCostTransactionDto {
  @IsUUID()
  @IsNotEmpty()
  clientRequestId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CostTransactionQueryDto {
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
  @IsIn(COST_TYPES)
  eventType?: string;

  @IsOptional()
  @IsIn(COST_TRANSACTION_SOURCE_TYPES)
  sourceType?: string;

  @IsOptional()
  @IsIn(COST_TRANSACTION_STATUSES)
  status?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsUUID()
  productionRunId?: string;

  @IsOptional()
  @IsUUID()
  productionOrderId?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;
}
