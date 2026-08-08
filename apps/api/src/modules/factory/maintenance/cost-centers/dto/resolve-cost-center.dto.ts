import { IsString, IsOptional, IsIn, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ASSIGNMENT_RESOURCE_TYPES } from './create-operational-cost-center-assignment.dto';

export class ResolveCostCenterDto {
  @ApiProperty({ enum: ASSIGNMENT_RESOURCE_TYPES, example: 'MACHINE' })
  @IsString()
  @IsIn(ASSIGNMENT_RESOURCE_TYPES)
  resourceType: string;

  @ApiPropertyOptional({ description: 'Exactly one resource id must be present and match resourceType.' })
  @IsOptional()
  @IsString()
  machineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productionLineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productionUnitId?: string;

  @ApiPropertyOptional({ description: 'Reference date for historical/future resolution. Defaults to today.' })
  @IsOptional()
  @IsDateString()
  referenceDate?: string;
}
