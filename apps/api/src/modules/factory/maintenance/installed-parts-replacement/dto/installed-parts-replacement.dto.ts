import { IsString, IsNumber, IsOptional, Min, IsBooleanString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryInstalledPartDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineComponentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sparePartId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maintenanceRequestId?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'REMOVED', 'REPLACED', 'DECOMMISSIONED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  onlyActive?: string;
}

export class QueryReplacementHistoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  machineComponentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maintenanceRequestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requiredPartId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}
