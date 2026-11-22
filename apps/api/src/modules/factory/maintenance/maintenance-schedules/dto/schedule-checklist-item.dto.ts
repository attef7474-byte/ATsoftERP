import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CHECKLIST_RESULT_TYPES } from '../../maintenance-checklist-items/checklist-item-validation';

/**
 * A complete representation of one checklist template item inside the unified
 * schedule editor. `id` identifies an existing template item; absence creates
 * a new one. Execution actors and snapshots are never accepted here.
 */
export class ScheduleChecklistItemDto {
  @ApiPropertyOptional({ description: 'Existing checklist template item id; omit when adding a new item' })
  @IsOptional()
  @IsString()
  id?: string;

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
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @ApiPropertyOptional({ enum: CHECKLIST_RESULT_TYPES, default: 'PASS_FAIL' })
  @IsOptional()
  @IsIn(CHECKLIST_RESULT_TYPES as unknown as string[])
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
