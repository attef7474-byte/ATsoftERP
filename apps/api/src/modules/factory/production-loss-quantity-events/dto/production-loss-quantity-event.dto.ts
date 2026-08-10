import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PRODUCTION_LOSS_TYPES } from '../production-loss-quantity-events.constants';

export class RecordLossDto {
  @IsUUID()
  @IsNotEmpty()
  requestId!: string;

  @IsEnum(PRODUCTION_LOSS_TYPES)
  type!: string;

  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'productionLoss.invalidQuantity' })
  @IsPositive({ message: 'productionLoss.quantityMustBePositive' })
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  unit!: string;

  @IsOptional()
  @IsString()
  productionRunId?: string;

  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @IsOptional()
  @IsString()
  outputEventId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  stage?: string;

  @IsOptional()
  @IsString()
  productionLineId?: string;

  @IsOptional()
  @IsString()
  machineId?: string;

  @IsOptional()
  @IsString()
  measurementPointId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  reasonId?: string;

  @IsOptional()
  @IsString()
  sourceEventId?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CorrectLossDto {
  @IsUUID()
  @IsNotEmpty()
  requestId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'productionLoss.invalidQuantity' })
  @IsPositive({ message: 'productionLoss.quantityMustBePositive' })
  quantity?: number;

  @IsOptional()
  @IsString()
  reasonId?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class LossQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsEnum(PRODUCTION_LOSS_TYPES)
  type?: string;

  @IsOptional()
  @IsString()
  productionRunId?: string;

  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @IsOptional()
  @IsString()
  machineId?: string;

  @IsOptional()
  @IsString()
  productionLineId?: string;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
