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

export function paginate(page = 1, pageSize = 20) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 20);
  const skip = (safePage - 1) * safePageSize;
  return { skip, take: safePageSize };
}

export function nowPlusDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}
