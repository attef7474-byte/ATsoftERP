import { IsString, IsNumber, IsOptional, Min, IsBoolean, IsBooleanString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';

export class QueryMaintenanceBomDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() machineId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() componentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) limit?: number;
}

export class CreateMaintenanceBomDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() machineId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() componentId?: string;
}

export class UpdateMaintenanceBomDto extends PartialType(CreateMaintenanceBomDto) {}

export class CreateMaintenanceBomVersionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveDate?: string;
}

export class QueryBomVersionDto {
  @ApiPropertyOptional() @IsOptional() @IsBooleanString() isActive?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) limit?: number;
}

export class ActivateVersionDto {
  @ApiProperty() @IsString() versionId: string;
}

export class CreateMaintenanceBomItemDto {
  @ApiProperty() @IsString() sparePartId: string;
  @ApiProperty() @IsNumber() @Min(0) quantity: number;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() usageNote?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCritical?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
}

export class UpdateMaintenanceBomItemDto extends PartialType(CreateMaintenanceBomItemDto) {}
