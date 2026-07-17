import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const STATUSES = ['PENDING', 'PRINTING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;

export class UpdatePrintJobDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsString()
  @IsIn(STATUSES)
  status?: string;
}
