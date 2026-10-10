import { IsString, IsOptional, IsIn, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMaintenanceTaskDto {
  @ApiPropertyOptional({ enum: ['MAINTENANCE_REQUEST', 'WORK_ORDER', 'DIRECT'] })
  @IsOptional() @IsIn(['MAINTENANCE_REQUEST', 'WORK_ORDER', 'DIRECT'])
  sourceType?: 'MAINTENANCE_REQUEST' | 'WORK_ORDER' | 'DIRECT';

  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty()
  requestId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty()
  workOrderId?: string;

  @ApiPropertyOptional({ enum: ['MACHINE', 'PRODUCTION_LINE', 'GENERAL'] })
  @IsOptional() @IsIn(['MACHINE', 'PRODUCTION_LINE', 'GENERAL'])
  scopeType?: 'MACHINE' | 'PRODUCTION_LINE' | 'GENERAL';

  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty()
  productionLineId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty()
  machineId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty()
  machineComponentId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  workLocation?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty()
  costCenterId?: string;

  @ApiPropertyOptional({ description: 'Legacy title; new execution titles are generated.' })
  @IsOptional() @IsString() @MaxLength(1000)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
