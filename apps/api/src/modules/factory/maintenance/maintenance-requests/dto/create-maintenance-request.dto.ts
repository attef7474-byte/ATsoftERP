import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMaintenanceRequestDto {
  @ApiProperty({ example: 'machine-id' })
  @IsString()
  machineId: string;

  @ApiProperty({ example: 'CORRECTIVE' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ example: 'MEDIUM' })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: string;

  @ApiProperty({ example: 'Motor bearing replacement' })
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
