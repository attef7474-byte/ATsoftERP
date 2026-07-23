import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

const COMPONENT_TYPES = ['MECHANICAL', 'ELECTRICAL', 'CONTROL', 'PNEUMATIC', 'HYDRAULIC', 'HEATING', 'COOLING', 'SENSOR', 'SAFETY', 'CONVEYOR', 'FRAME', 'UTILITY', 'OTHER'];
const CRITICALITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export class CreateMachineComponentDto {
  @ApiProperty()
  @IsString()
  machineId: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  parentComponentId?: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: COMPONENT_TYPES })
  @IsString() @IsIn(COMPONENT_TYPES)
  componentType: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  locationInMachine?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  model?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional({ enum: CRITICALITY_LEVELS, default: 'MEDIUM' })
  @IsString() @IsOptional() @IsIn(CRITICALITY_LEVELS)
  criticality?: string;

  @ApiPropertyOptional({ default: 'ACTIVE' })
  @IsString() @IsOptional() @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}

export class UpdateMachineComponentDto {
  @ApiPropertyOptional()
  @IsString() @IsOptional()
  machineId?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  parentComponentId?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  code?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: COMPONENT_TYPES })
  @IsString() @IsOptional() @IsIn(COMPONENT_TYPES)
  componentType?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  locationInMachine?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  model?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional({ enum: CRITICALITY_LEVELS })
  @IsString() @IsOptional() @IsIn(CRITICALITY_LEVELS)
  criticality?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional() @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}
