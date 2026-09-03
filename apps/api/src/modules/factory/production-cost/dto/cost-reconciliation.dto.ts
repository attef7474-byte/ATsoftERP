import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { COST_NATURE_VALUES, ENTRY_ROLE_VALUES, OPERATIONAL_LEDGER_SOURCE_TYPES } from '../production-cost.constants';
import { COST_PURPOSE_VALUES } from '../../../../common/cost-purpose/cost-purpose.constants';

/**
 * COST-R1C: optional read-only reconciliation audit scoping. Filters are tenant-scoped
 * (company/branch always come from the active context) and only narrow the set of
 * OperationalCostTransaction rows audited. The audit itself remains whole-ledger for the
 * scoped rows; defects are always DETECTED and reported, never repaired.
 */
export class OperationalCostReconciliationQueryDto {
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
  @IsIn([...OPERATIONAL_LEDGER_SOURCE_TYPES])
  sourceType?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
