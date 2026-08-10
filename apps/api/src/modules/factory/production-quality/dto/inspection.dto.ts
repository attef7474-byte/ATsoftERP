import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
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
  ValidateNested,
} from 'class-validator';
import { DISPOSITION_ACTIONS, QUALITY_UNITS } from '../production-quality.constants';

export class CreateInspectionDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @IsUUID()
  @IsNotEmpty()
  clientRequestId!: string;

  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @IsOptional()
  @IsString()
  productionRunId?: string;

  @IsOptional()
  @IsString()
  outputEventId?: string;

  @IsOptional()
  @IsString()
  finishedGoodsReceiptId?: string;

  @IsOptional()
  @IsString()
  finishedGoodsReceiptLineId?: string;

  @IsOptional()
  @IsString()
  samplingPointId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  productionLineId?: string;

  @IsOptional()
  @IsString()
  machineId?: string;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  sampledQuantity!: number;

  @IsIn(QUALITY_UNITS)
  @IsNotEmpty()
  unit!: string;

  @IsDateString()
  @IsNotEmpty()
  inspectedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class InspectionQueryDto {
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
  status?: string;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @IsOptional()
  @IsString()
  productionRunId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class InspectionResultEntryDto {
  @IsString()
  @IsNotEmpty()
  characteristicId!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  valueNumeric?: number;

  @IsOptional()
  @IsBoolean()
  valueBoolean?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  valueText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  valueChoice?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  method?: string;

  @IsIn(['MANUAL', 'DEVICE', 'DERIVED'])
  @IsOptional()
  sourceType?: string = 'MANUAL';

  // Required for non-numeric characteristics (numeric pass is derived from limits).
  @IsOptional()
  @IsBoolean()
  pass?: boolean;
}

export class RecordInspectionResultsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InspectionResultEntryDto)
  results!: InspectionResultEntryDto[];
}

export class CreateDispositionDto {
  @IsIn(DISPOSITION_ACTIONS)
  @IsNotEmpty()
  action!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity!: number;

  @IsIn(QUALITY_UNITS)
  @IsNotEmpty()
  unit!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ApproveDispositionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class RejectDispositionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
