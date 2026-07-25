import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMachineResponsibilityAssignmentDto {
  @ApiProperty() @IsString() machineId: string;
  @ApiProperty() @IsString() maintenancePersonnelId: string;
  @ApiProperty() @IsString() responsibilityRole: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isPrimary?: boolean;
  @ApiProperty() @IsString() startDate: string;
  @ApiPropertyOptional() @IsString() @IsOptional() endDate?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

export class UpdateMachineResponsibilityAssignmentDto {
  @ApiPropertyOptional() @IsString() @IsOptional() machineId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() maintenancePersonnelId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() responsibilityRole?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isPrimary?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() startDate?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() endDate?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}
