import { CAPACITY_OUTPUT_UNITS, CAPACITY_TIME_BASES } from '../production-capacity-standards/production-capacity.constants';

export const PRODUCTION_RUN_AUDIT_ENTITY = 'ProductionRun';
export const PRODUCTION_OUTPUT_EVENT_AUDIT_ENTITY = 'ProductionOutputEvent';
export const PRODUCTION_MEASUREMENT_POINT_AUDIT_ENTITY = 'ProductionMeasurementPoint';
export const PRODUCTION_RUN_NUMBER_SEQUENCE = 'PRODUCTION_RUN';
export const PRODUCTION_MEASUREMENT_POINT_NUMBER_SEQUENCE = 'PRODUCTION_MEASUREMENT_POINT';

export const PRODUCTION_RUN_STATUSES = ['READY', 'RUNNING', 'PAUSED', 'COMPLETED', 'ABORTED'] as const;
export const PRODUCTION_RUN_ACTIVE_STATUSES = ['READY', 'RUNNING', 'PAUSED'] as const;
export const PRODUCTION_RUN_TERMINAL_STATUSES = ['COMPLETED', 'ABORTED'] as const;
export const PRODUCTION_RUN_ACTIONABLE_STATUSES: Record<string, readonly string[]> = {
  PAUSE: ['RUNNING'],
  RESUME: ['PAUSED'],
  COMPLETE: ['RUNNING', 'PAUSED'],
  ABORT: ['READY', 'RUNNING', 'PAUSED'],
};
export const PRODUCTION_RUN_TRANSITION_ACTIONS = ['CREATE', 'START', 'PAUSE', 'RESUME', 'COMPLETE', 'ABORT'] as const;
export const PRODUCTION_OUTPUT_EVENT_TYPES = ['PRODUCTION', 'CORRECTION', 'RESET'] as const;
export const PRODUCTION_MEASUREMENT_ROLES = ['INPUT', 'INTERMEDIATE', 'FINAL_OUTPUT', 'WASTE', 'REWORK'] as const;
export const PRODUCTION_MEASUREMENT_SOURCES = ['MANUAL', 'COUNTER'] as const;
export const PRODUCTION_MEASUREMENT_POINT_STATUSES = ['DRAFT', 'ACTIVE', 'INACTIVE'] as const;
export const PRODUCTION_OUTPUT_UNITS = CAPACITY_OUTPUT_UNITS;
export const PRODUCTION_TIME_BASES = CAPACITY_TIME_BASES;

export const PRODUCTION_RUN_PERMISSION_KEYS = [
  'production-run:read',
  'production-run:start',
  'production-run:pause',
  'production-run:resume',
  'production-run:complete',
  'production-run:abort',
] as const;

export const PRODUCTION_OUTPUT_PERMISSION_KEYS = [
  'production-output:record',
  'production-output:correct',
] as const;

export const PRODUCTION_MEASUREMENT_POINT_PERMISSION_KEYS = [
  'production-measurement-point:create',
  'production-measurement-point:read',
  'production-measurement-point:update',
  'production-measurement-point:delete',
  'production-measurement-point:activate',
  'production-measurement-point:deactivate',
] as const;