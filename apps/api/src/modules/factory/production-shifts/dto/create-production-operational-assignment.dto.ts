import { IsString, IsNotEmpty, IsOptional, IsDateString, IsBoolean, IsNumber, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const OPERATIONAL_RESOURCE_TYPES = ['MACHINE', 'LINE', 'UNIT'] as const;

export class CreateProductionOperationalAssignmentDto {
  @ApiPropertyOptional({ description: 'Assignment code (auto-generated when omitted)' })
  @IsOptional() @IsString() code?: string;

  @ApiProperty({ enum: OPERATIONAL_RESOURCE_TYPES })
  @IsIn(OPERATIONAL_RESOURCE_TYPES) resourceType: string;

  @ApiPropertyOptional() @IsOptional() @IsString() machineId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() productionLineId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() productionUnitId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() shiftId?: string;

  @ApiPropertyOptional({ description: 'Capacity per shift (pieces/hours/etc.)' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) capacityPerShift?: number;

  @ApiProperty() @IsDateString() effectiveFrom: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean() isPrimary?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateProductionOperationalAssignmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() machineId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() productionLineId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() productionUnitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shiftId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) capacityPerShift?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrimary?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class ProductionOperationalAssignmentQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(OPERATIONAL_RESOURCE_TYPES) resourceType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() machineId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() productionLineId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() productionUnitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shiftId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveOn?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(1) limit?: number;
}
