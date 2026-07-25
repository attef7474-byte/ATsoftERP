import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMaintenanceRequestAssignmentDto {
  @ApiProperty() @IsString() maintenanceRequestId: string;
  @ApiProperty() @IsString() maintenancePersonnelId: string;
  @ApiProperty() @IsString() assignmentRole: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

export class UpdateMaintenanceRequestAssignmentDto {
  @ApiPropertyOptional() @IsString() @IsOptional() assignmentRole?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() acceptedAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() startedAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() completedAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() cancelledAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}
