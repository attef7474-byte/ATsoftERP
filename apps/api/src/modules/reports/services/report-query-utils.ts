import {
  buildDateRange,
  DateRangeFilter,
} from '../../../common/helpers/date-range.util';

export interface ReportQuery {
  dateFrom?: string;
  dateTo?: string;
  companyId?: string;
  branchId?: string;
  departmentId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  productionLineId?: string;
  machineId?: string;
  machineComponentId?: string;
  componentId?: string;
  operationTypeId?: string;
  costCenterId?: string;
  sparePartId?: string;
  machineCategoryId?: string;
  maintenanceType?: string;
  priority?: string;
  requestStatus?: string;
  assigneeId?: string;
  dueStatus?: string;
  warehouseId?: string;
  locationId?: string;
  productId?: string;
  productCategoryId?: string;
  movementType?: string;
  adjustmentReason?: string;
  countStatus?: string;
  varianceOnly?: boolean;
  entityType?: string;
  scanPurpose?: string;
  result?: string;
  scannedById?: string;
  status?: string;
  location?: string;
  type?: string;
  entityName?: string;
  entity?: string;
  action?: string;
  userId?: string;
}

type DateRangeFieldFilter = DateRangeFilter;

export function buildDateFilter<TField extends string = 'createdAt'>(
  dateFrom?: string,
  dateTo?: string,
  field?: TField,
): Partial<Record<TField, DateRangeFieldFilter>> {
  const range = buildDateRange(dateFrom, dateTo);
  if (!range) return {};

  const key = (field ?? 'createdAt') as TField;
  return { [key]: range } as Partial<Record<TField, DateRangeFieldFilter>>;
}

/**
 * Hard upper bound for report list pages. Prevents an unbounded `take` reaching
 * SQL Server when a caller supplies an excessive pageSize. Exports request
 * EXPORT_ROW_LIMIT + 1 rows (5001), which stays comfortably below this ceiling.
 */
export const REPORT_MAX_PAGE_SIZE = 10000;

export function paginate(page = 1, pageSize = 20) {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const requestedSize = Math.floor(Number(pageSize) || 20);
  const safePageSize = Math.min(REPORT_MAX_PAGE_SIZE, Math.max(1, requestedSize));
  const skip = (safePage - 1) * safePageSize;
  return { skip, take: safePageSize };
}

export function nowPlusDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}
