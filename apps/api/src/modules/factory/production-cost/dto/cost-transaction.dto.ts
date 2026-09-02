import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  COST_NATURE_VALUES,
  COST_TRANSACTION_SOURCE_TYPES,
  COST_TRANSACTION_STATUSES,
  COST_TYPES,
  COST_UNITS,
  ENTRY_ROLE_VALUES,
} from '../production-cost.constants';
import { COST_PURPOSE_VALUES } from '../../../../common/cost-purpose/cost-purpose.constants';

export class PostCostTransactionDto {
  @IsUUID()
  @IsNotEmpty()
  clientRequestId!: string;

  @IsIn(COST_TYPES)
  @IsNotEmpty()
  eventType!: string;

  @IsIn([...COST_TRANSACTION_SOURCE_TYPES])
  @IsNotEmpty()
  sourceType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  sourceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceLineId?: string;

  @IsOptional()
  @IsIn(COST_NATURE_VALUES)
  costNature?: string;

  @IsOptional()
  @IsIn(COST_PURPOSE_VALUES)
  costPurpose?: string;

  @IsOptional()
  @IsIn(ENTRY_ROLE_VALUES)
  entryRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceNumberSnapshot?: string;

  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @IsOptional()
  @IsString()
  productionRunId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productCodeSnapshot?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productNameSnapshot?: string;

  @IsOptional()
  @IsString()
  productionVersionId?: string;

  @IsOptional()
  @IsString()
  productionPackagingId?: string;

  @IsOptional()
  @IsString()
  productionLineId?: string;

  @IsOptional()
  @IsString()
  machineId?: string;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  standardCostSnapshotId?: string;

  @IsOptional()
  @IsString()
  outputEventId?: string;

  @IsOptional()
  @IsString()
  calculationId?: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity!: number;

  @IsIn(COST_UNITS)
  @IsNotEmpty()
  unit!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  rate!: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  @IsDateString()
  @IsNotEmpty()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ReverseCostTransactionDto {
  @IsUUID()
  @IsNotEmpty()
  clientRequestId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CostTransactionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsIn(COST_TYPES)
  eventType?: string;

  @IsOptional()
  @IsIn(COST_TRANSACTION_SOURCE_TYPES)
  sourceType?: string;

  @IsOptional()
  @IsIn(COST_TRANSACTION_STATUSES)
  status?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  productionRunId?: string;

  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsIn(COST_NATURE_VALUES)
  costNature?: string;

  @IsOptional()
  @IsIn(COST_PURPOSE_VALUES)
  costPurpose?: string;

  @IsOptional()
  @IsIn(ENTRY_ROLE_VALUES)
  entryRole?: string;
}

/**
 * Canonical Unified Cost Ledger (COST-R1B) query. Filters are tenant-scoped and
 * composition of costNature/costPurpose/entryRole/sourceLineId/canonical dimension
 * is enforced in the service.
 */
export class LedgerQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsIn(COST_NATURE_VALUES)
  costNature?: string;

  @IsOptional()
  @IsIn(COST_PURPOSE_VALUES)
  costPurpose?: string;

  @IsOptional()
  @IsIn(ENTRY_ROLE_VALUES)
  entryRole?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  maintenanceWorkOrderId?: string;

  @IsOptional()
  @IsString()
  maintenanceRequestId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  productionRunId?: string;

  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @IsOptional()
  @IsString()
  machineId?: string;
}

/**
 * Canonical ledger totals (COST-R1B). Grouped by costPurpose by default.
 * Only canonical PRIMARY_COST entries contribute to net totals; REVERSAL entries
 * subtract their negated amount, so the returned total is the true net position.
 */
export class LedgerTotalsQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsIn(COST_PURPOSE_VALUES)
  costPurpose?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  maintenanceWorkOrderId?: string;

  @IsOptional()
  @IsString()
  maintenanceRequestId?: string;
}
