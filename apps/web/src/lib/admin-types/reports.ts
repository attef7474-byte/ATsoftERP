export interface MachineOperationalSummary {
  id: string;
  code: string;
  name: string;
  status: string;
  category: { id: string; name: string; code: string } | null;
  activeRequests: number;
  openTasks: number;
  activeDowntime: number;
  totalDowntimeHoursThisMonth: number;
  nextMaintenanceDueDate: string | null;
  nextMaintenanceTitle: string | null;
  dueStatus: string | null;
}

export interface OperationalSummaryResponse {
  machines: MachineOperationalSummary[];
  totals: {
    totalMachines: number;
    totalActiveRequests: number;
    totalOpenTasks: number;
    totalActiveDowntime: number;
    totalDowntimeHoursThisMonth: number;
  };
}

export interface RequestSummary {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
}

export interface DowntimeSummary {
  total: number;
  active: number;
  closed: number;
  cancelled: number;
  totalDurationHours: number;
}

export interface ScheduleSummary {
  total: number;
  active: number;
  inactive: number;
  overdue: number;
  dueSoon: number;
  notDue: number;
  expired: number;
}

export interface BalanceSummary {
  totalBalances: number;
  totalProducts: number;
  totalQuantity: number;
  totalWarehouses: number;
  byWarehouse: { warehouseId: string; count: number }[];
}

export interface CountSummary {
  total: number;
  draft: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

export interface MovementSummary {
  total: number;
  draft: number;
  posted: number;
  cancelled: number;
  totalInQty: number;
  totalOutQty: number;
}

export interface AdjustmentSummary {
  total: number;
  draft: number;
  posted: number;
  cancelled: number;
  totalPositiveAdjustment: number;
  totalNegativeAdjustment: number;
}
