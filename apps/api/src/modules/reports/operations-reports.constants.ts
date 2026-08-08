export const OPERATIONS_REPORT_PERMISSION_KEYS = {
  read: 'reports.operations:read',
  export: 'reports.operations:export',
} as const;

export const OPERATIONS_REPORT_PERMISSION_KEYS_LIST = [
  OPERATIONS_REPORT_PERMISSION_KEYS.read,
  OPERATIONS_REPORT_PERMISSION_KEYS.export,
] as const;

export const OPERATIONS_REPORT_FORMULA_VERSION = 'PHASE_2_OPERATIONS_V1';
export const OPERATIONS_REPORT_EXPORT_AUDIT_ENTITY = 'OperationsReportExport';
export const OPERATIONS_REPORT_TIMEZONE = 'UTC';

export const OPERATIONS_REPORT_LIMITS = {
  maxWindowDays: 366,
  maxPageSize: 50,
  maxExportRows: 1000,
} as const;

export const OPERATIONS_REPORT_CARDINALITY = {
  strategy: 'SECTIONED_AUTHORITY_COMPOSITION',
  rule: 'Maintenance events, production runs, and operational-cost transactions remain separate authoritative sections and are never multiplied through a cross-fact join.',
  cache: 'NONE_TENANT_SAFE_LIVE_QUERY',
} as const;
