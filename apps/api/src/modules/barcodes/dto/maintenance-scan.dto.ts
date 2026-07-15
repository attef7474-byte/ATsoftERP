import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const PURPOSES = ['MAINTENANCE_LOOKUP', 'MAINTENANCE_REQUEST', 'MAINTENANCE_TASK', 'DOWNTIME', 'MACHINE_CHECK', 'PART_LOOKUP'];

export class MaintenanceScanDto {
  @ApiProperty()
  @IsString()
  value: string;

  @ApiPropertyOptional({ enum: PURPOSES })
  @IsOptional()
  @IsString()
  @IsIn(PURPOSES)
  purpose?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maintenanceRequestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maintenanceTaskId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
