export const PERFORMANCE_SCORING_MODES = [
  'LINEAR_TARGET',
  'LINEAR_RANGE',
  'THRESHOLD_BANDS',
  'CAPPED_RATIO',
  'TARGET_BAND',
  'INVERSE_LINEAR',
] as const;
export type PerformanceScoringMode = (typeof PERFORMANCE_SCORING_MODES)[number];

export const PERFORMANCE_CONFIG_STATUSES = ['DRAFT', 'ACTIVE', 'INACTIVE', 'SUPERSEDED'] as const;
export type PerformanceConfigStatus = (typeof PERFORMANCE_CONFIG_STATUSES)[number];

export const PERFORMANCE_SCORE_STATUSES = [
  'CALCULABLE',
  'INSUFFICIENT_DATA',
  'NOT_APPLICABLE',
  'CONFIGURATION_MISSING',
] as const;
export type PerformanceScoreStatus = (typeof PERFORMANCE_SCORE_STATUSES)[number];

export const PERFORMANCE_TARGET_SCOPE_TYPES = [
  'COMPANY',
  'BRANCH',
  'PROFILE',
  'DEPARTMENT',
  'JOB_TITLE',
  'LINE',
  'MACHINE',
  'PRODUCT',
  'LINE_PRODUCT',
  'MACHINE_PRODUCT',
] as const;
export type PerformanceTargetScopeType = (typeof PERFORMANCE_TARGET_SCOPE_TYPES)[number];
