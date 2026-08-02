import { IsString, IsOptional, IsInt, IsBoolean, IsNumber, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export const CHECKLIST_RESULT_TYPES = ['PASS_FAIL', 'TEXT', 'NUMBER', 'BOOLEAN', 'READING'];

export class CreateMaintenanceChecklistItemDto {
  @ApiProperty()
  @IsString()
  scheduleId: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @ApiPropertyOptional({ enum: CHECKLIST_RESULT_TYPES, default: 'PASS_FAIL' })
  @IsOptional()
  @IsIn(CHECKLIST_RESULT_TYPES)
  resultType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;
}
