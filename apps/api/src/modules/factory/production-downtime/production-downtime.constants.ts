export const DOWNTIME_LOG_AUDIT_ENTITY = 'DowntimeLog';
export const DOWNTIME_SEGMENT_AUDIT_ENTITY = 'DowntimeSegment';

export const DOWNTIME_SEGMENT_STATUSES = ['OPEN', 'CLOSED', 'SUPERSEDED', 'CANCELLED'] as const;
export const DOWNTIME_OWNER_DOMAINS = ['MAINTENANCE', 'PRODUCTION', 'EXTERNAL'] as const;
export const DOWNTIME_SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const;
export const DOWNTIME_OCCURRENCE_TYPES = ['PLANNED', 'UNPLANNED'] as const;
export const DOWNTIME_SOURCE_TYPES = ['MANUAL', 'PRODUCTION'] as const;

export const PRODUCTION_DOWNTIME_PERMISSION_KEYS = {
  read: 'production-downtime:read',
  record: 'production-downtime:record',
  correct: 'production-downtime:correct',
  close: 'production-downtime:close',
  linkMaintenance: 'production-downtime:link-maintenance',
} as const;

export const DOWNTIME_SEGMENT_INCLUDE = {
  downtimeLog: true,
  reason: {
    select: {
      id: true,
      code: true,
      nameAr: true,
      nameEn: true,
      lossCategory: true,
      plannedDefault: true,
      severityDefault: true,
    },
  },
  productionRun: {
    select: {
      id: true,
      runNumber: true,
      status: true,
      product: { select: { id: true, productCode: true, nameAr: true, nameEn: true } },
    },
  },
  productionOrder: { select: { id: true, orderNumber: true } },
  shift: { select: { id: true, shiftName: true } },
  productionLine: { select: { id: true, name: true } },
  machine: { select: { id: true, machineCode: true, name: true } },
  maintenanceRequest: { select: { id: true, requestNumber: true, status: true, machine: { select: { id: true, machineCode: true } } } },
  maintenanceWorkOrder: { select: { id: true, workOrderNumber: true, status: true } },
  recordedBy: { select: { id: true, firstName: true, lastName: true } },
  closedBy: { select: { id: true, firstName: true, lastName: true } },
  cancelledBy: { select: { id: true, firstName: true, lastName: true } },
} as const;
