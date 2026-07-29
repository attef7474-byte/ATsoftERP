import { IsString, IsNumber, IsOptional, Min, IsBoolean, IsBooleanString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryConditionBalanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sparePartId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ enum: ['NEW', 'USED_SERVICEABLE', 'USED_REPAIRABLE', 'DAMAGED_REPAIRABLE', 'DAMAGED_NOT_REPAIRABLE'] })
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  availableOnly?: string;
}

export class QueryConditionMovementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sparePartId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ enum: ['NEW', 'USED_SERVICEABLE', 'USED_REPAIRABLE', 'DAMAGED_REPAIRABLE', 'DAMAGED_NOT_REPAIRABLE'] })
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiPropertyOptional({ enum: ['IN', 'OUT'] })
  @IsOptional()
  @IsString()
  direction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maintenanceRequestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requiredPartId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class RecordConditionMovementDto {
  @ApiProperty()
  @IsString()
  sparePartId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty()
  @IsString()
  warehouseId: string;

  @ApiProperty({ enum: ['NEW', 'USED_SERVICEABLE', 'USED_REPAIRABLE', 'DAMAGED_REPAIRABLE', 'DAMAGED_NOT_REPAIRABLE'] })
  @IsString()
  condition: string;

  @ApiProperty({ enum: ['IN', 'OUT'] })
  @IsString()
  direction: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maintenanceRequestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requiredPartId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inventoryMovementId?: string;

  @ApiPropertyOptional({ enum: ['RETURNED_REMOVED_PART', 'NO_REMOVED_PART', 'NEW_INSTALLATION'] })
  @IsOptional()
  @IsString()
  replacementAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
