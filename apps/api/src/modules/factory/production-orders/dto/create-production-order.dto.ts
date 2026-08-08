import { IsDecimal, IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CAPACITY_TIME_BASES } from '../../production-capacity-standards/production-capacity.constants';
import { PRODUCTION_ORDER_PRIORITIES, PRODUCTION_ORDER_SOURCE_TYPES } from '../production-order.constants';

export class CreateProductionOrderDto {
  @IsUUID() clientRequestId!: string;
  @IsString() productionProductDefinitionId!: string;
  @IsString() productionVersionId!: string;
  @IsOptional() @IsString() productionPackagingId?: string;
  @IsString() productionUnitId!: string;
  @IsString() productionLineId!: string;
  @IsOptional() @IsString() machineId?: string;
  @IsDecimal({ decimal_digits: '0,4', force_decimal: false }) plannedQuantity!: string;
  @IsIn(CAPACITY_TIME_BASES) capacityTimeBasis!: string;
  @IsISO8601() plannedStartAt!: string;
  @IsISO8601() plannedEndAt!: string;
  @IsOptional() @IsIn(PRODUCTION_ORDER_PRIORITIES) priority?: string;
  @IsOptional() @IsIn(PRODUCTION_ORDER_SOURCE_TYPES) sourceType?: string;
  @IsOptional() @IsString() @MaxLength(255) sourceReference?: string;
  @IsString() costCenterId!: string;
  @IsOptional() @IsString() issueWarehouseId?: string;
  @IsOptional() @IsString() receiptWarehouseId?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
