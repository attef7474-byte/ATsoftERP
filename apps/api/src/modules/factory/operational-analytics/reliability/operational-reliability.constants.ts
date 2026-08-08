import { OEE_FORMULA_VERSION } from '../../production-analytics/production-analytics.constants';

export const OPERATIONAL_RELIABILITY_PERMISSION_KEYS = {
  read: 'operational-reliability:read',
  export: 'operational-reliability:export',
} as const;

export const OPERATIONAL_RELIABILITY_PERMISSION_KEYS_LIST = [
  OPERATIONAL_RELIABILITY_PERMISSION_KEYS.read,
  OPERATIONAL_RELIABILITY_PERMISSION_KEYS.export,
] as const;

export const OPERATIONAL_RELIABILITY_EXPORT_AUDIT_ENTITY = 'OperationalReliabilityExport';
export const OPERATIONAL_RELIABILITY_TIMEZONE = 'UTC';

export const OPERATIONAL_RELIABILITY_LIMITS = {
  maxWindowDays: 366,
  maxPageSize: 50,
  maxDrilldownEvents: 500,
  maxExportRows: 5000,
} as const;

// ── 2C formula-versioning contract (D-2C-3, readiness contract §4) ──
// Code-level authoritative metric metadata. No persisted formula-version table.
export const RELIABILITY_FORMULA_VERSIONS = {
  mtbf: '2C_MTBF_V1',
  mttr: '2C_MTTR_V1',
  totalDowntime: '2C_TOTAL_DOWNTIME_V1',
  downtimeByDimension: '2C_DOWNTIME_BY_DIMENSION_V1',
  repeatFailures: '2C_REPEAT_FAILURES_V1',
  repeatFailureRate: '2C_REPEAT_FAILURE_RATE_V1',
  emergencyResponseTime: '2C_EMERGENCY_RESPONSE_V1',
  slaTimes: '2C_SLA_V1',
} as const;

// Canonical availability reuses the existing production OEE authority formula version.
export const RELIABILITY_AVAILABILITY_FORMULA_VERSION = OEE_FORMULA_VERSION;

export const RELIABILITY_MAINTENANCE_AUTHORITY = 'maintenance-reliability';
export const RELIABILITY_PRODUCTION_ANALYTICS_AUTHORITY = 'production-analytics';

export const RELIABILITY_SOURCE_MODELS = {
  maintenanceEvent: 'DowntimeLog',
  productionDowntimeDetail: 'DowntimeSegment',
  plannedTimeBasis: 'ProductionSession',
  slaSource: 'MaintenanceRequest',
} as const;

// Maintenance availability remains a domain-specific/compatibility metric (D-2C-2).
export const LEGACY_MAINTENANCE_AVAILABILITY_FORMULA_VERSION = 'LEGACY_OR_MAINTENANCE_DOMAIN_AVAILABILITY';

export const RELIABILITY_METRIC_METADATA: ReadonlyArray<{
  key: string;
  formulaVersion: string;
  authority: string;
  model: string;
  basis?: string;
}> = [
  { key: 'mtbf', formulaVersion: RELIABILITY_FORMULA_VERSIONS.mtbf, authority: RELIABILITY_MAINTENANCE_AUTHORITY, model: RELIABILITY_SOURCE_MODELS.maintenanceEvent, basis: 'window between first and last live failure event divided by (liveEvents - 1)' },
  { key: 'mttr', formulaVersion: RELIABILITY_FORMULA_VERSIONS.mttr, authority: RELIABILITY_MAINTENANCE_AUTHORITY, model: RELIABILITY_SOURCE_MODELS.maintenanceEvent, basis: 'mean of DowntimeLog.durationMinutes over live closed repairs' },
  { key: 'totalDowntime', formulaVersion: RELIABILITY_FORMULA_VERSIONS.totalDowntime, authority: RELIABILITY_MAINTENANCE_AUTHORITY, model: RELIABILITY_SOURCE_MODELS.maintenanceEvent, basis: 'sum of DowntimeLog.durationMinutes over live events' },
  { key: 'downtimeByDimension', formulaVersion: RELIABILITY_FORMULA_VERSIONS.downtimeByDimension, authority: RELIABILITY_MAINTENANCE_AUTHORITY, model: RELIABILITY_SOURCE_MODELS.maintenanceEvent, basis: 'grouped sum of DowntimeLog.durationMinutes by machine, production line, or failure cause' },
  { key: 'repeatFailures', formulaVersion: RELIABILITY_FORMULA_VERSIONS.repeatFailures, authority: RELIABILITY_MAINTENANCE_AUTHORITY, model: RELIABILITY_SOURCE_MODELS.maintenanceEvent, basis: 'live events with DowntimeLog.isRepeatFailure = true' },
  { key: 'repeatFailureRate', formulaVersion: RELIABILITY_FORMULA_VERSIONS.repeatFailureRate, authority: RELIABILITY_MAINTENANCE_AUTHORITY, model: RELIABILITY_SOURCE_MODELS.maintenanceEvent, basis: 'repeat live events / total live events * 100' },
  { key: 'emergencyResponseTime', formulaVersion: RELIABILITY_FORMULA_VERSIONS.emergencyResponseTime, authority: RELIABILITY_MAINTENANCE_AUTHORITY, model: RELIABILITY_SOURCE_MODELS.maintenanceEvent, basis: 'mean of (responseStartedAt - detectedAt) over positive live samples' },
  { key: 'slaTimes', formulaVersion: RELIABILITY_FORMULA_VERSIONS.slaTimes, authority: RELIABILITY_MAINTENANCE_AUTHORITY, model: RELIABILITY_SOURCE_MODELS.slaSource, basis: 'mean due-based and actual completion durations from MaintenanceRequest' },
  { key: 'availability', formulaVersion: RELIABILITY_AVAILABILITY_FORMULA_VERSION, authority: RELIABILITY_PRODUCTION_ANALYTICS_AUTHORITY, model: 'ProductionSession+DowntimeSegment', basis: 'operatingMinutes / plannedMinutes from completed session planned windows minus unplanned segment intersections' },
];

export const RELIABILITY_NORMALIZATION_METADATA = {
  cancelledExcluded: true,
  supersededOriginalsExcluded: true,
  correctedReplacementCountedOnce: true,
  dedupByDowntimeLogId: true,
} as const;
