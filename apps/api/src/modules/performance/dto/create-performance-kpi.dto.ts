import { IsString, IsOptional, IsBoolean, IsIn, IsInt, Min, Max, MaxLength, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PERFORMANCE_KPI_DOMAINS,
  PERFORMANCE_KPI_UNITS,
  PERFORMANCE_KPI_DIRECTIONS,
  PERFORMANCE_KPI_AGGREGATIONS,
  PERFORMANCE_KPI_CALC_MODES,
  PERFORMANCE_KPI_STATUSES,
} from '../kpis/performance-kpi.constants';

export class CreatePerformanceKpiDto {
  @ApiProperty() @IsString() @MaxLength(100) code: string;
  @ApiProperty() @IsString() @MaxLength(200) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) nameAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) nameEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) descriptionAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) descriptionEn?: string;
  @ApiProperty({ enum: PERFORMANCE_KPI_DOMAINS }) @IsIn([...PERFORMANCE_KPI_DOMAINS]) domain: string;
  @ApiProperty({ enum: PERFORMANCE_KPI_UNITS }) @IsIn([...PERFORMANCE_KPI_UNITS]) measurementUnit: string;
  @ApiProperty({ enum: PERFORMANCE_KPI_DIRECTIONS }) @IsIn([...PERFORMANCE_KPI_DIRECTIONS]) direction: string;
  @ApiProperty({ enum: PERFORMANCE_KPI_AGGREGATIONS }) @IsIn([...PERFORMANCE_KPI_AGGREGATIONS]) aggregationType: string;
  @ApiProperty({ enum: PERFORMANCE_KPI_CALC_MODES }) @IsIn([...PERFORMANCE_KPI_CALC_MODES]) calculationMode: string;
  @ApiProperty() @IsString() @MaxLength(100) sourceContractKey: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(1000) calculationVersion?: number;
  @ApiPropertyOptional({ enum: PERFORMANCE_KPI_STATUSES }) @IsOptional() @IsIn([...PERFORMANCE_KPI_STATUSES]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
