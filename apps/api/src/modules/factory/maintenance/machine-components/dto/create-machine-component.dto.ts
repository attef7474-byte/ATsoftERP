import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

const COMPONENT_TYPES = ['MECHANICAL', 'ELECTRICAL', 'CONTROL', 'PNEUMATIC', 'HYDRAULIC', 'HEATING', 'COOLING', 'SENSOR', 'SAFETY', 'CONVEYOR', 'FRAME', 'UTILITY', 'OTHER'];
const CRITICALITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/**
 * Machine-specific physical attributes. These live on the association row,
 * never on the shared logical component.
 */
export class MachineComponentMachineInputDto {
  @ApiProperty()
  @IsString()
  machineId: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  locationInMachine?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  serialNumber?: string;
}

/**
 * Canonical create contract: ONE logical component with N active machine
 * associations. `machineId` is retained only for legacy single-machine callers;
 * the backend normalizes it into `machineIds` and never treats it as authority.
 */
export class CreateMachineComponentDto {
  @ApiPropertyOptional({ type: [String], description: 'Canonical set of machine ids to associate' })
  @IsArray() @IsOptional() @IsString({ each: true })
  machineIds?: string[];

  @ApiPropertyOptional({ description: 'Legacy single-machine compatibility field' })
  @IsString() @IsOptional()
  machineId?: string;

  @ApiPropertyOptional({ type: [MachineComponentMachineInputDto] })
  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => MachineComponentMachineInputDto)
  machineData?: MachineComponentMachineInputDto[];

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
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  model?: string;

  @ApiPropertyOptional({ enum: CRITICALITY_LEVELS, default: 'MEDIUM' })
  @IsString() @IsOptional() @IsIn(CRITICALITY_LEVELS)
  criticality?: string;

  @ApiPropertyOptional({ default: 'ACTIVE' })
  @IsString() @IsOptional() @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;

  /** Deprecated single-machine value, normalized onto the first association. */
  @ApiPropertyOptional({ deprecated: true })
  @IsString() @IsOptional()
  locationInMachine?: string;

  /** Deprecated shared serial, only accepted for a single-machine create. */
  @ApiPropertyOptional({ deprecated: true })
  @IsString() @IsOptional()
  serialNumber?: string;
}

/**
 * Edit contract. `machineIds` expresses the desired final ACTIVE set.
 * `toAdd` / `toKeep` / `toRemove` express the same change as an explicit
 * set-based delta; both are reconciled in one atomic transaction and never
 * create a new MachineComponent row.
 */
export class UpdateMachineComponentDto {
  @ApiPropertyOptional({ type: [String], description: 'Desired final active machine set' })
  @IsArray() @IsOptional() @IsString({ each: true })
  machineIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray() @IsOptional() @IsString({ each: true })
  toAdd?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray() @IsOptional() @IsString({ each: true })
  toKeep?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray() @IsOptional() @IsString({ each: true })
  toRemove?: string[];

  @ApiPropertyOptional({ type: [MachineComponentMachineInputDto] })
  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => MachineComponentMachineInputDto)
  machineData?: MachineComponentMachineInputDto[];

  @ApiPropertyOptional({ description: 'Legacy compatibility field; cannot change component identity' })
  @IsString() @IsOptional()
  machineId?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  parentComponentId?: string;

  @ApiPropertyOptional({ description: 'Identity is immutable; supplying the current code is allowed.' })
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
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  model?: string;

  @ApiPropertyOptional({ enum: CRITICALITY_LEVELS })
  @IsString() @IsOptional() @IsIn(CRITICALITY_LEVELS)
  criticality?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional() @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;

  @ApiPropertyOptional({ deprecated: true })
  @IsString() @IsOptional()
  locationInMachine?: string;

  @ApiPropertyOptional({ deprecated: true })
  @IsString() @IsOptional()
  serialNumber?: string;
}

/**
 * Compatibility endpoint. It now creates ONE component and N associations,
 * never one component row per machine.
 */
export class BatchCreateMachineComponentDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  machineIds: string[];

  @ApiPropertyOptional({ type: [MachineComponentMachineInputDto] })
  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => MachineComponentMachineInputDto)
  machineData?: MachineComponentMachineInputDto[];

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
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  model?: string;

  @ApiPropertyOptional({ enum: CRITICALITY_LEVELS, default: 'MEDIUM' })
  @IsString() @IsOptional() @IsIn(CRITICALITY_LEVELS)
  criticality?: string;

  @ApiPropertyOptional({ default: 'ACTIVE' })
  @IsString() @IsOptional() @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;

  @ApiPropertyOptional({ deprecated: true })
  @IsString() @IsOptional()
  locationInMachine?: string;

  @ApiPropertyOptional({ deprecated: true })
  @IsString() @IsOptional()
  serialNumber?: string;
}
