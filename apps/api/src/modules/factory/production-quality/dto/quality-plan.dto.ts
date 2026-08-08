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
import { CHARACTERISTIC_TYPES, CRITICALITY_LEVELS, INSPECTION_STAGES } from '../production-quality.constants';

export class CreateQualityPlanDto {
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

export class UpdateQualityPlanDto {
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

export class RejectQualityPlanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class DeactivateQualityPlanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class QualityPlanQueryDto {
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
  @IsUUID()
  productionProductDefinitionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class CreateCharacteristicDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameAr!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameEn!: string;

  @IsIn(CHARACTERISTIC_TYPES)
  @IsOptional()
  characteristicType?: string = 'NUMERIC';

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @IsUUID()
  productionUnitId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  lowerLimit?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  targetValue?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  upperLimit?: number;

  @IsIn(CRITICALITY_LEVELS)
  @IsOptional()
  criticality?: string = 'MAJOR';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  samplingRule?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class UpdateCharacteristicDto extends CreateCharacteristicDto {}

export class CreateSamplingPointDto {
  @IsIn(INSPECTION_STAGES)
  @IsOptional()
  stage?: string = 'FINAL_OUTPUT';

  @IsOptional()
  @IsUUID()
  measurementPointId?: string;

  @IsOptional()
  @IsUUID()
  productionLineId?: string;

  @IsOptional()
  @IsUUID()
  machineId?: string;

  @IsOptional()
  @IsBoolean()
  appliesToMaterial?: boolean;

  @IsOptional()
  @IsBoolean()
  appliesToFinishedGoods?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sampleFrequency?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  sampleSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSamplingPointDto extends CreateSamplingPointDto {}
