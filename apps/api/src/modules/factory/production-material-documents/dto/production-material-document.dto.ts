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

export class CreateMaterialDocumentLineDto {
  @IsUUID()
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
  @IsUUID()
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
  @IsUUID()
  substitutedProductId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  substitutionReason?: string;

  @IsOptional()
  @IsUUID()
  originalIssueLineId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CreateMaterialDocumentDto {
  @IsEnum(PRODUCTION_MATERIAL_DOCUMENT_TYPES)
  documentType!: string;

  @IsUUID()
  @IsNotEmpty()
  productionOrderId!: string;

  @IsUUID()
  @IsNotEmpty()
  productionRunId!: string;

  @IsOptional()
  @IsUUID()
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
  @IsUUID()
  productionOrderId?: string;

  @IsOptional()
  @IsUUID()
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
