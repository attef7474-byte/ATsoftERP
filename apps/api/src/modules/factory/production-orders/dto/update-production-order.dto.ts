import { IsDecimal, IsIn, IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CAPACITY_TIME_BASES } from '../../production-capacity-standards/production-capacity.constants';
import { PRODUCTION_ORDER_PRIORITIES, PRODUCTION_ORDER_SOURCE_TYPES } from '../production-order.constants';

export class UpdateProductionOrderDto {
  @IsInt() @Min(0) lockVersion!: number;
  @IsOptional() @IsString() productionProductDefinitionId?: string;
  @IsOptional() @IsString() productionVersionId?: string;
  @IsOptional() @IsString() productionPackagingId?: string | null;
  @IsOptional() @IsString() productionUnitId?: string;
  @IsOptional() @IsString() productionLineId?: string;
  @IsOptional() @IsString() machineId?: string | null;
  @IsOptional() @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) plannedQuantity?: string;
  @IsOptional() @IsIn(CAPACITY_TIME_BASES) capacityTimeBasis?: string;
  @IsOptional() @IsISO8601() plannedStartAt?: string;
  @IsOptional() @IsISO8601() plannedEndAt?: string;
  @IsOptional() @IsIn(PRODUCTION_ORDER_PRIORITIES) priority?: string;
  @IsOptional() @IsIn(PRODUCTION_ORDER_SOURCE_TYPES) sourceType?: string;
  @IsOptional() @IsString() @MaxLength(255) sourceReference?: string | null;
  @IsOptional() @IsString() costCenterId?: string;
  @IsOptional() @IsString() issueWarehouseId?: string | null;
  @IsOptional() @IsString() receiptWarehouseId?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string | null;
}
