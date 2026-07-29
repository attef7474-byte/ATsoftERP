import { IsString, IsNumber, IsOptional, Min, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';

export class QueryPreventiveSparePartPlanDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() scheduleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() machineId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) limit?: number;
}

export class CreatePreventiveSparePartPlanDto {
  @ApiProperty() @IsString() scheduleId: string;
  @ApiProperty() @IsString() machineId: string;
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}

export class UpdatePreventiveSparePartPlanDto extends PartialType(CreatePreventiveSparePartPlanDto) {}

export class CreatePlanItemDto {
  @ApiProperty() @IsString() sparePartId: string;
  @ApiProperty() @IsNumber() @Min(0) plannedQuantity: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) availableQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() condition?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isAvailable?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdatePlanItemDto extends PartialType(CreatePlanItemDto) {}

export class GeneratePlanFromScheduleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class CopyToRequestDto {
  @ApiProperty() @IsString() requestId: string;
  @ApiPropertyOptional() @IsOptional() @IsString({ each: true }) itemIds?: string[];
}
