export const LOSS_REASON_AUDIT_ENTITY = 'OperationalLossReason';

export const LOSS_REASON_STATUSES = ['DRAFT', 'ACTIVE', 'INACTIVE'] as const;
export const LOSS_REASON_ACTIVE_STATUS = 'ACTIVE';

export const LOSS_REASON_CATEGORIES = [
  'DOWNTIME',
  'WASTE',
  'SCRAP',
  'REWORK',
  'QUALITY',
  'SETUP',
  'MAINTENANCE',
  'OTHER',
] as const;

export const LOSS_REASON_SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const;

export const LOSS_REASON_MAINTENANCE_POLICIES = ['REQUIRED', 'OPTIONAL', 'FORBIDDEN'] as const;

export const PRODUCTION_LOSS_REASON_PERMISSION_KEYS = [
  'production-loss-reason:create',
  'production-loss-reason:read',
  'production-loss-reason:update',
  'production-loss-reason:delete',
  'production-loss-reason:activate',
  'production-loss-reason:deactivate',
] as const;

// Default loss reason seed rows (referenced for a governed reason master).
export const DEFAULT_LOSS_REASONS: ReadonlyArray<{
  code: string;
  nameAr: string;
  nameEn: string;
  lossCategory: string;
  plannedDefault: boolean;
  severityDefault: string;
  maintenanceRequestPolicy: string;
}> = [
  { code: 'PLANNED', nameAr: 'توقف مبرمج', nameEn: 'Planned downtime', lossCategory: 'DOWNTIME', plannedDefault: true, severityDefault: 'MINOR', maintenanceRequestPolicy: 'OPTIONAL' },
  { code: 'UNPLANNED', nameAr: 'توقف غير مبرمج', nameEn: 'Unplanned downtime', lossCategory: 'DOWNTIME', plannedDefault: false, severityDefault: 'MAJOR', maintenanceRequestPolicy: 'OPTIONAL' },
  { code: 'BREAKDOWN', nameAr: 'عطل', nameEn: 'Breakdown', lossCategory: 'DOWNTIME', plannedDefault: false, severityDefault: 'CRITICAL', maintenanceRequestPolicy: 'REQUIRED' },
  { code: 'SETUP', nameAr: 'إعداد وتجهيز', nameEn: 'Setup and changeover', lossCategory: 'SETUP', plannedDefault: true, severityDefault: 'MINOR', maintenanceRequestPolicy: 'FORBIDDEN' },
  { code: 'QUALITY', nameAr: 'توقف بسبب الجودة', nameEn: 'Quality stoppage', lossCategory: 'QUALITY', plannedDefault: false, severityDefault: 'MINOR', maintenanceRequestPolicy: 'OPTIONAL' },
  { code: 'RAW_MATERIAL', nameAr: 'نقص المواد الخام', nameEn: 'Raw material shortage', lossCategory: 'OTHER', plannedDefault: false, severityDefault: 'MAJOR', maintenanceRequestPolicy: 'OPTIONAL' },
  { code: 'WASTE', nameAr: 'هالك عام', nameEn: 'General waste', lossCategory: 'WASTE', plannedDefault: false, severityDefault: 'MINOR', maintenanceRequestPolicy: 'FORBIDDEN' },
  { code: 'SCRAP', nameAr: 'مواد خردة مرفوضة', nameEn: 'Rejected scrap material', lossCategory: 'SCRAP', plannedDefault: false, severityDefault: 'MINOR', maintenanceRequestPolicy: 'FORBIDDEN' },
  { code: 'REWORK', nameAr: 'إعادة عمل', nameEn: 'Rework', lossCategory: 'REWORK', plannedDefault: false, severityDefault: 'MINOR', maintenanceRequestPolicy: 'FORBIDDEN' },
];
