import { IsString, IsDateString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PreviewPerformanceKpiDto {
  @ApiProperty() @IsString() operationalPersonId: string;
  @ApiProperty() @IsString() kpiCode: string;
  @ApiProperty() @IsDateString() dateFrom: string;
  @ApiProperty() @IsDateString() dateTo: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(200) evidenceLimit?: number;
}
