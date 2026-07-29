import { IsString, IsNumber, IsOptional, Min, IsBoolean, IsBooleanString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryRepairOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sparePartId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() warehouseId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceCondition?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() maintenanceRequestId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() replacementHistoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() machineId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() machineComponentId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(1) limit?: number;
}

export class CreateRepairOrderDto {
  @ApiProperty() @IsString() sparePartId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() productId?: string;
  @ApiProperty() @IsString() warehouseId: string;
  @ApiProperty({ enum: ['USED_REPAIRABLE', 'DAMAGED_REPAIRABLE'] }) @IsString() sourceCondition: string;
  @ApiProperty() @IsNumber() @Min(0.001) sourceQuantity: number;
  @ApiPropertyOptional() @IsOptional() @IsString() targetCondition?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() maintenanceRequestId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() requiredPartId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() replacementHistoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() installedPartId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() conditionInMovementId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() machineId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() machineComponentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() failureDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() externalRepair?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() externalRepairProviderName?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) estimatedRepairCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreateRepairOrderFromReplacementDto {
  @ApiProperty() @IsString() replacementHistoryId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateRepairStatusDto {
  @ApiPropertyOptional() @IsOptional() @IsString() repairDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CompleteServiceableDto {
  @ApiProperty() @IsNumber() @Min(0.001) repairedQuantity: number;
  @ApiProperty({ enum: ['USED_SERVICEABLE', 'USED_REPAIRABLE'] }) @IsString() targetCondition: string;
  @ApiPropertyOptional() @IsOptional() @IsString() testResult?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() testNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() repairDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CompletePartialDto {
  @ApiProperty() @IsNumber() @Min(0.001) repairedQuantity: number;
  @ApiProperty() @IsNumber() @Min(0) scrappedQuantity: number;
  @ApiProperty({ enum: ['USED_SERVICEABLE', 'USED_REPAIRABLE'] }) @IsString() targetCondition: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class ScrapRepairOrderDto {
  @ApiProperty() @IsNumber() @Min(0.001) scrappedQuantity: number;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CancelRepairOrderDto {
  @ApiProperty() @IsString() reason: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreateRepairActionDto {
  @ApiProperty({ enum: ['INSPECTION', 'DIAGNOSIS', 'REPAIR', 'OVERHAUL', 'PART_REPLACED', 'CLEANING', 'TEST', 'SCRAP_DECISION', 'STATUS_CHANGE', 'NOTE'] }) @IsString() actionType: string;
  @ApiPropertyOptional({ enum: ['PLANNED', 'IN_PROGRESS', 'DONE', 'FAILED', 'CANCELLED'] }) @IsOptional() @IsString() actionStatus?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() result?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() performedByUserId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() performedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) durationMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class QueryRepairablePartsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() condition?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() machineId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sparePartId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(1) limit?: number;
}
