import { Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { OPERATIONAL_RELIABILITY_LIMITS } from '../operational-reliability.constants';

export class OperationalReliabilityQueryDto {
  @IsISO8601() dateFrom!: string;
  @IsISO8601() dateTo!: string;
  @IsOptional() @IsString() machineId?: string;
  @IsOptional() @IsString() productionLineId?: string;
  @IsOptional() @IsString() operationTypeId?: string;
  @IsOptional() @IsString() costCenterId?: string;
}

export class OperationalReliabilityDrilldownDto extends OperationalReliabilityQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(OPERATIONAL_RELIABILITY_LIMITS.maxPageSize) limit = 20;
}

export class OperationalReliabilityExportDto extends OperationalReliabilityQueryDto {}
