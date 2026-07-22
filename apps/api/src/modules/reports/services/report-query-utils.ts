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
  machineId?: string;
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

type DateRangeFilter = {
  gte?: Date;
  lte?: Date;
};

export function buildDateFilter<TField extends string = 'createdAt'>(
  dateFrom?: string,
  dateTo?: string,
  field?: TField,
): Partial<Record<TField, DateRangeFilter>> {
  if (!dateFrom && !dateTo) return {};

  const range: DateRangeFilter = {};
  if (dateFrom) range.gte = new Date(dateFrom);
  if (dateTo) range.lte = new Date(dateTo);

  const key = (field ?? 'createdAt') as TField;
  return { [key]: range } as Partial<Record<TField, DateRangeFilter>>;
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
