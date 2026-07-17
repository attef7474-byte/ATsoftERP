import { IsString, IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const JOB_TYPES = ['LABEL', 'TEMPLATE', 'PRODUCT_LABEL', 'MACHINE_CARD'] as const;

export class CreatePrintJobDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  labelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  printerName?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  copies?: number = 1;

  @ApiPropertyOptional({ enum: JOB_TYPES, default: 'LABEL' })
  @IsOptional()
  @IsString()
  @IsIn(JOB_TYPES)
  jobType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
