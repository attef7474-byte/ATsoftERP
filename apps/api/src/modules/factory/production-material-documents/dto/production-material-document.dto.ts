import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PRODUCTION_MATERIAL_DOCUMENT_TYPES } from '../production-material-documents.constants';
import { COST_PURPOSE_VALUES } from '../../../../common/cost-purpose/cost-purpose.constants';

export class CreateMaterialDocumentLineDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit!: string;

  @IsOptional()
  @IsString()
  warehouseLocationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  batchNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  substitutedProductId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  substitutionReason?: string;

  @IsOptional()
  @IsString()
  originalIssueLineId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  // Cost Purpose R1 — canonical "WHY" attribution. Leave unset to use the source
  // default (PRODUCTION). A non-default value is an override and requires the
  // canonical cost-purpose:override permission + a mandatory reason (line-level).
  @IsOptional()
  @IsEnum(COST_PURPOSE_VALUES)
  costPurpose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  costPurposeOverrideReason?: string;
}

export class CreateMaterialDocumentDto {
  @IsEnum(PRODUCTION_MATERIAL_DOCUMENT_TYPES)
  documentType!: string;

  @IsString()
  @IsNotEmpty()
  productionOrderId!: string;

  @IsString()
  @IsNotEmpty()
  productionRunId!: string;

  @IsOptional()
  @IsString()
  issueWarehouseId?: string;

  @IsOptional()
  @IsUUID()
  requestId?: string;

  @IsOptional()
  @IsDateString()
  documentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMaterialDocumentLineDto)
  lines!: CreateMaterialDocumentLineDto[];
}

export class UpdateMaterialDocumentDto {
  @IsOptional()
  @IsDateString()
  documentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMaterialDocumentLineDto)
  lines?: CreateMaterialDocumentLineDto[];
}

export class ReverseMaterialDocumentDto {
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @IsOptional()
  @IsDateString()
  documentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CancelMaterialDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class MaterialDocumentQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsEnum(PRODUCTION_MATERIAL_DOCUMENT_TYPES)
  documentType?: string;

  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @IsOptional()
  @IsString()
  productionRunId?: string;

  @IsOptional()
  @IsString()
  status?: string;

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
