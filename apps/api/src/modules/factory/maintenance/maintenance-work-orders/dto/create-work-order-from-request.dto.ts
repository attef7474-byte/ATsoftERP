import { IsString, IsOptional, IsIn, IsNumber, Min, ValidateNested, IsArray, IsNotEmpty, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateWorkOrderPartDto } from './create-maintenance-work-order.dto';

const WORK_ORDER_TYPES = ['CORRECTIVE', 'PREVENTIVE', 'PREDICTIVE', 'OVERHAUL', 'OTHER'] as const;
const WORK_ORDER_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

/**
 * R2-C canonical create-from-request payload. `requestId`, `machineId`, `companyId`
 * and `branchId` are always server-derived from the validated maintenance request
 * and the active operational context; the global ValidationPipe (forbidNonWhitelisted)
 * rejects clients that try to sneak those fields into the request body. The
 * `machineComponentId` defaults from the request and may only be overridden by a
 * component that belongs to the request machine.
 */
export class CreateWorkOrderFromRequestDto {
  @ApiPropertyOptional({ example: 'Fix conveyor motor overheating' })
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

  @ApiPropertyOptional({ description: 'Component override; must belong to the request machine.' })
  @IsOptional()
  @IsString()
  machineComponentId?: string;

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