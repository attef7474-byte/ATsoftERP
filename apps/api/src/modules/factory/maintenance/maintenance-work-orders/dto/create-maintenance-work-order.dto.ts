import { IsString, IsOptional, IsIn, IsNumber, Min, ValidateNested, IsArray, IsNotEmpty, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const WORK_ORDER_TYPES = ['CORRECTIVE', 'PREVENTIVE', 'PREDICTIVE', 'OVERHAUL', 'OTHER'] as const;
const WORK_ORDER_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export class CreateWorkOrderPartDto {
  @ApiPropertyOptional({ description: 'Spare part id. productId is derived from the spare part when omitted.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sparePartId?: string;

  @ApiPropertyOptional({ description: 'Product id (inventory item). Required when sparePartId is omitted.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  productId?: string;

  @ApiProperty({ example: 1 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.0001)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 25.5 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateMaintenanceWorkOrderDto {
  @ApiProperty({ example: 'Fix conveyor motor overheating' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: WORK_ORDER_TYPES, default: 'CORRECTIVE' })
  @IsOptional()
  @IsIn(WORK_ORDER_TYPES)
  type?: string;

  @ApiPropertyOptional({ enum: WORK_ORDER_PRIORITIES, default: 'MEDIUM' })
  @IsOptional()
  @IsIn(WORK_ORDER_PRIORITIES)
  priority?: string;

  @ApiPropertyOptional({ description: 'Machine must belong to the active context.' })
  @IsOptional()
  @IsString()
  machineId?: string;

  @ApiPropertyOptional({ description: 'Machine component must belong to the active context.' })
  @IsOptional()
  @IsString()
  machineComponentId?: string;

  @ApiPropertyOptional({ description: 'Optional originating maintenance request (tenant-scoped).' })
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiPropertyOptional({ description: 'Default warehouse used for parts issue (tenant-scoped).' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'User responsible for execution.' })
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'User supervising the work order.' })
  @IsOptional()
  @IsString()
  supervisorId?: string;

  @ApiPropertyOptional({ example: '2026-08-10T08:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  plannedStartAt?: string;

  @ApiPropertyOptional({ example: '2026-08-12T16:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  plannedEndAt?: string;

  @ApiPropertyOptional({ example: 1500 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  estimatedCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [CreateWorkOrderPartDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkOrderPartDto)
  parts?: CreateWorkOrderPartDto[];
}
