import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { PRODUCTION_ORDER_PRIORITIES, PRODUCTION_ORDER_STATUSES } from '../production-order.constants';

export class ProductionOrderQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(PRODUCTION_ORDER_STATUSES) status?: string;
  @IsOptional() @IsIn(PRODUCTION_ORDER_PRIORITIES) priority?: string;
  @IsOptional() @IsString() productionProductDefinitionId?: string;
  @IsOptional() @IsString() productionLineId?: string;
  @IsOptional() @IsString() machineId?: string;
  @IsOptional() @IsISO8601() dateFrom?: string;
  @IsOptional() @IsISO8601() dateTo?: string;
}
