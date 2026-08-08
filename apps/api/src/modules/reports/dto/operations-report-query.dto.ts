import { Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { OPERATIONS_REPORT_LIMITS } from '../operations-reports.constants';

export class OperationsReportQueryDto {
  @IsISO8601() dateFrom!: string;
  @IsISO8601() dateTo!: string;
  @IsOptional() @IsString() productionLineId?: string;
  @IsOptional() @IsString() machineId?: string;
}

export class OperationsReportPageDto extends OperationsReportQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(OPERATIONS_REPORT_LIMITS.maxPageSize) limit = 20;
}

export class OperationsReportExportDto extends OperationsReportQueryDto {}
