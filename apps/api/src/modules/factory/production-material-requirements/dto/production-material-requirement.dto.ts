import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
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
import {
  PRODUCTION_MATERIAL_COMPONENT_ROLES,
  PRODUCTION_MATERIAL_OVER_ISSUE_POLICIES,
} from '../production-material-requirements.constants';

export class PrepareRequirementLineDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  plannedQuantityPerUnit!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  baseUnit!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  issueUnit!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  conversionFactor?: number;

  @IsOptional()
  @IsEnum(PRODUCTION_MATERIAL_COMPONENT_ROLES)
  componentRole?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productionStage?: string;

  @IsOptional()
  @IsBoolean()
  lotControlRequired?: boolean;

  @IsOptional()
  @IsEnum(PRODUCTION_MATERIAL_OVER_ISSUE_POLICIES)
  overIssuePolicy?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  tolerancePercent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CreateRequirementLineDto extends PrepareRequirementLineDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;
}

export class PrepareMaterialRequirementDto {
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRequirementLineDto)
  lines!: CreateRequirementLineDto[];
}

export class UpdateMaterialRequirementDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRequirementLineDto)
  lines?: CreateRequirementLineDto[];
}

export class CancelMaterialRequirementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class RecordMaterialConsumptionDto {
  @IsString()
  @IsNotEmpty()
  productionOrderId!: string;

  @IsOptional()
  @IsString()
  productionRunId?: string;

  @IsOptional()
  @IsString()
  requirementLineId?: string;

  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsString()
  sourceDocumentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceDocumentNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sourceDocumentType?: string;

  @IsUUID()
  @IsNotEmpty()
  requestId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CorrectMaterialConsumptionDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  newQuantity!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class ConsumptionQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
