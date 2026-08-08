import { IsString, IsOptional, IsIn, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const COST_CENTER_TYPES = ['PRODUCTION', 'MAINTENANCE', 'PROJECT', 'DEVELOPMENT', 'QUALITY', 'UTILITIES', 'ADMIN', 'OTHER'] as const;

export class CreateCostCenterDto {
  @ApiPropertyOptional({ example: 'PRODUCTION-GENERAL' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Production Cost Center' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: COST_CENTER_TYPES, example: 'PRODUCTION' })
  @IsString()
  @IsIn(COST_CENTER_TYPES)
  type: string;

  @ApiPropertyOptional({ description: 'Parent cost center (company-scoped hierarchy, D5). Ignored/validated against the active tenant.' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Optional effective overlay start. status remains the gate (D7).' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ description: 'Optional effective overlay end; must be >= effectiveFrom when set.' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({ description: 'UI/default-display flag only; never a resolution precedence input.' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ description: 'Required when overriding scope/effective fields on an existing cost center.' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Never trusted for tenant scoping (derived from the active context). Validated against the context.' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Nullable = company-level cost center. Validated against the active context.' })
  @IsOptional()
  @IsString()
  branchId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  administrationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;
}
