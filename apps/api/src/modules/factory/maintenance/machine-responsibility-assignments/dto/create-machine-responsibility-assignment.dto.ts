import { IsString, IsOptional, IsBoolean, IsIn, IsArray, ArrayUnique } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SCOPE_TYPES = ['MACHINE', 'PRODUCTION_LINE', 'DEPARTMENT'] as const;

export class CreateMachineResponsibilityAssignmentDto {
  @ApiPropertyOptional({ enum: SCOPE_TYPES, default: 'MACHINE' })
  @IsOptional()
  @IsString()
  @IsIn(SCOPE_TYPES)
  scopeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productionLineId?: string;

  @ApiProperty()
  @IsString()
  maintenancePersonnelId: string;

  @ApiProperty()
  @IsString()
  responsibilityRole: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @ApiProperty()
  @IsString()
  startDate: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

/**
 * Multi-scope batch create: one logical responsibility assignment (personnel + role)
 * covering MULTIPLE full production lines and/or MULTIPLE explicit machines in one save.
 */
export class CreateMachineResponsibilityBatchDto {
  @ApiProperty()
  @IsString()
  maintenancePersonnelId: string;

  @ApiProperty()
  @IsString()
  responsibilityRole: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  fullLineIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  explicitMachineIds?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @ApiProperty()
  @IsString()
  startDate: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

/**
 * Multi-scope batch update: identifies the logical assignment by (personnel + role) and
 * applies a KEEP / ADD / DEACTIVATE diff over its full-line and explicit-machine scopes.
 */
export class UpdateMachineResponsibilityBatchDto {
  @ApiProperty()
  @IsString()
  maintenancePersonnelId: string;

  @ApiProperty()
  @IsString()
  responsibilityRole: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  fullLineIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  explicitMachineIds?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * End a logical multi-scope assignment identified by (personnel + role): transactionally
 * soft-ends every active line/machine scope row while preserving history.
 */
export class EndMachineResponsibilityAssignmentDto {
  @ApiProperty()
  @IsString()
  maintenancePersonnelId: string;

  @ApiProperty()
  @IsString()
  responsibilityRole: string;
}

export class UpdateMachineResponsibilityAssignmentDto {
  @ApiPropertyOptional({ enum: SCOPE_TYPES })
  @IsOptional()
  @IsString()
  @IsIn(SCOPE_TYPES)
  scopeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productionLineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maintenancePersonnelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  responsibilityRole?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
