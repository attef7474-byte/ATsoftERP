export const PERFORMANCE_TARGET_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'INACTIVE'] as const;
export const PERFORMANCE_TARGET_SCOPE_TYPES = ['COMPANY', 'BRANCH', 'UNIT', 'LINE', 'MACHINE', 'PRODUCT'] as const;
export const ANALYTICS_GRAINS = ['DAY', 'WEEK', 'MONTH'] as const;
export const LOSS_CATEGORIES = ['WASTE', 'SCRAP', 'REWORK', 'OTHER'] as const;

export type PerformanceTargetStatus = typeof PERFORMANCE_TARGET_STATUSES[number];
export type PerformanceTargetScopeType = typeof PERFORMANCE_TARGET_SCOPE_TYPES[number];
export type AnalyticsGrain = typeof ANALYTICS_GRAINS[number];

export const OEE_FORMULA_VERSION = 'PHASE_1_9_OEE_V1';

export const ANALYTICS_TIMEZONE = 'UTC';

export const PERFORMANCE_TARGET_AUDIT_ENTITY = 'ProductionPerformanceTarget';
export const ANALYTICS_EXPORT_AUDIT_ENTITY = 'ProductionAnalyticsExport';
export const ANALYTICS_INVALIDATE_AUDIT_ENTITY = 'ProductionAnalyticsInvalidation';
export const PERFORMANCE_TARGET_NUMBER_SEQUENCE = 'PRODUCTION_PERFORMANCE_TARGET';

export const PERFORMANCE_TARGET_PERMISSION_KEYS = {
  targetCreate: 'production-performance-target:create',
  targetRead: 'production-performance-target:read',
  targetUpdate: 'production-performance-target:update',
  targetDelete: 'production-performance-target:delete',
  targetSubmit: 'production-performance-target:submit',
  targetApprove: 'production-performance-target:approve',
  targetDeactivate: 'production-performance-target:deactivate',
} as const;

export const ANALYTICS_PERMISSION_KEYS = {
  analyticsRead: 'production-analytics:read',
  analyticsExport: 'production-analytics:export',
  analyticsInvalidate: 'production-analytics:invalidate',
} as const;

export const PERFORMANCE_TARGET_PERMISSION_KEYS_LIST = [
  PERFORMANCE_TARGET_PERMISSION_KEYS.targetCreate,
  PERFORMANCE_TARGET_PERMISSION_KEYS.targetRead,
  PERFORMANCE_TARGET_PERMISSION_KEYS.targetUpdate,
  PERFORMANCE_TARGET_PERMISSION_KEYS.targetDelete,
  PERFORMANCE_TARGET_PERMISSION_KEYS.targetSubmit,
  PERFORMANCE_TARGET_PERMISSION_KEYS.targetApprove,
  PERFORMANCE_TARGET_PERMISSION_KEYS.targetDeactivate,
] as const;

export const ANALYTICS_PERMISSION_KEYS_LIST = [
  ANALYTICS_PERMISSION_KEYS.analyticsRead,
  ANALYTICS_PERMISSION_KEYS.analyticsExport,
  ANALYTICS_PERMISSION_KEYS.analyticsInvalidate,
] as const;

export const ANALYTICS_LIMITS = {
  maxWindowDays: 366,
  maxPageSize: 50,
  maxSummaryRuns: 2000,
  maxExportRows: 5000,
  maxDrilldownEventsPerRun: 500,
  maxParetoTop: 20,
  maxTrendBuckets: 366,
} as const;

export const ANALYTICS_REPORTS = [
  'oee',
  'trends',
  'loss-pareto',
  'bottlenecks',
  'capacity-variance',
  'drilldown',
  'output',
  'downtime',
  'losses',
  'quality',
  'materials',
  'cost',
] as const;

export type AnalyticsReport = typeof ANALYTICS_REPORTS[number];

export const RUN_STATUSES_TERMINAL = ['COMPLETED', 'ABORTED'] as const;
