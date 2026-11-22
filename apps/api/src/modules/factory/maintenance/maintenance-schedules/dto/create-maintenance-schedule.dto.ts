import { IsString, IsOptional, IsInt, IsDateString, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ScheduleChecklistItemDto } from './schedule-checklist-item.dto';

export class CreateMaintenanceScheduleDto {
  @ApiProperty()
  @IsString()
  machineId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsString()
  frequency: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  intervalDays?: number;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [ScheduleChecklistItemDto], description: 'Complete checklist template edited atomically with the schedule' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ScheduleChecklistItemDto)
  checklistItems?: ScheduleChecklistItemDto[];
}
