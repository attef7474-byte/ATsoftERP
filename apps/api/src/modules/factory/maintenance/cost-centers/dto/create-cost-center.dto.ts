import { IsString, IsOptional, IsIn } from 'class-validator';
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  administrationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;
}
