import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IssueStockDto {
  @ApiProperty()
  @IsString()
  warehouseId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  issuedQuantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  // Batch Y — cost attribution fields
  @ApiPropertyOptional({ enum: ['MAINTENANCE', 'OPERATION', 'PROJECT', 'QUALITY', 'SERVICES', 'GENERAL'] })
  @IsOptional()
  @IsString()
  costOwnerType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costOwnerAdministrationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costDepartmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costProductionLineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costMachineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costMachineComponentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receivedByUserId?: string;

  // Batch Y Addendum — part condition + replacement action
  @ApiPropertyOptional({ enum: ['NEW', 'USED_SERVICEABLE', 'USED_REPAIRABLE', 'DAMAGED_REPAIRABLE', 'DAMAGED_NOT_REPAIRABLE'] })
  @IsOptional()
  @IsString()
  issuedStockCondition?: string;

  @ApiPropertyOptional({ enum: ['RETURNED_REMOVED_PART', 'NO_REMOVED_PART', 'NEW_INSTALLATION'] })
  @IsOptional()
  @IsString()
  replacementAction?: string;

  // Removed part fields (required when replacementAction = RETURNED_REMOVED_PART)
  @ApiPropertyOptional({ enum: ['NEW', 'USED_SERVICEABLE', 'USED_REPAIRABLE', 'DAMAGED_REPAIRABLE', 'DAMAGED_NOT_REPAIRABLE'] })
  @IsOptional()
  @IsString()
  removedPartCondition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  removedPartWarehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  removedPartQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  removedPartReturnedByUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  noReturnReason?: string;
}

export class ReturnStockDto {
  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  returnQuantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
