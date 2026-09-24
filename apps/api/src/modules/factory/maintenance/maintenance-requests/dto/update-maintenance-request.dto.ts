import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Header-only fields for a maintenance request edit (R2-B contract T1/T2/T3).
 *
 * Lifecycle fields (status, startDate, endDate, downtimeHours, cost) are managed
 * exclusively through the dedicated transition endpoints and must never be
 * accepted here. Assignment is managed through the dedicated assign endpoint.
 * Required spare parts are managed through the dedicated parts endpoints.
 */
export class UpdateMaintenanceRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'MEDIUM' })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productionLineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineComponentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operationTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costCenterId?: string;
}