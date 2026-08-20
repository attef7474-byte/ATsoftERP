import { IsOptional, IsISO8601 } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReportingLineQueryDto {
  @ApiPropertyOptional({ description: 'ISO 8601 date to evaluate the hierarchy as of a specific point in time', example: '2026-08-20T10:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  asOf?: string;
}
