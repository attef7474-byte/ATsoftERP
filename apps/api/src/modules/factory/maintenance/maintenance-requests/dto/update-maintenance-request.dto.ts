import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateMaintenanceRequestDto } from './create-maintenance-request.dto';

export class UpdateMaintenanceRequestDto extends PartialType(CreateMaintenanceRequestDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  downtimeHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  cost?: number;
}
