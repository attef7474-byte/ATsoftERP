import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMaintenancePartAccountabilityDto {
  @ApiProperty() @IsString() maintenanceRequestId: string;
  @ApiProperty() @IsString() requiredPartId: string;
  @ApiProperty() @IsString() sparePartId: string;
  @ApiPropertyOptional() @IsString() @IsOptional() machineId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() machineComponentId?: string;
  @ApiProperty() @IsString() maintenancePersonnelId: string;
  @ApiProperty() @IsNumber() @Min(0) quantity: number;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() reportedUsedQuantity?: number;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() returnedQuantity?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() accountabilityNote?: string;
}

export class UpdateMaintenancePartAccountabilityDto {
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() quantity?: number;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() reportedUsedQuantity?: number;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() returnedQuantity?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() accountabilityNote?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() reportedAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() cancelledAt?: string;
}
