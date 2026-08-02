import { IsString, IsOptional, IsIn, IsNumber, Min, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const COST_ENTRY_TYPES = ['LABOR', 'PARTS', 'EXTERNAL', 'OTHER'] as const;

export class AddWorkOrderCostEntryDto {
  @ApiProperty({ enum: COST_ENTRY_TYPES })
  @IsString()
  @IsNotEmpty()
  @IsIn(COST_ENTRY_TYPES)
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 120.5 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: '2026-08-11T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  incurredAt?: string;
}

export class UpdateWorkOrderCostEntryDto {
  @ApiPropertyOptional({ enum: COST_ENTRY_TYPES })
  @IsOptional()
  @IsString()
  @IsIn(COST_ENTRY_TYPES)
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  incurredAt?: string;
}
