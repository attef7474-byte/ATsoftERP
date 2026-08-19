import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';
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
