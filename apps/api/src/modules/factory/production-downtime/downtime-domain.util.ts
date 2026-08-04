export const DOWNTIME_SEGMENT_STATUSES = ['OPEN', 'CLOSED', 'SUPERSEDED', 'CANCELLED'] as const;
export const DOWNTIME_OWNER_DOMAINS = ['MAINTENANCE', 'PRODUCTION', 'EXTERNAL'] as const;
export const DOWNTIME_SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const;
export const DOWNTIME_OCCURRENCE_TYPES = ['PLANNED', 'UNPLANNED'] as const;
export const DOWNTIME_SOURCE_TYPES = ['MANUAL', 'PRODUCTION'] as const;

export interface DowntimeInterval {
  startedAt: Date;
  endedAt: Date | null;
}

export function toDate(input: Date | string): Date {
  return typeof input === 'string' ? new Date(input) : input;
}

export function isValidDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

/** Duration in minutes between two instants, rounded to 4 decimals. */
export function computeDurationMinutes(startedAt: Date, endedAt: Date): number {
  const diffMs = endedAt.getTime() - startedAt.getTime();
  if (diffMs <= 0) return 0;
  return Math.round((diffMs / 60000) * 10000) / 10000;
}

/** True when interval [aStart, aEnd] overlaps interval [bStart, bEnd]. An open interval has no end. */
export function intervalsOverlap(a: DowntimeInterval, b: DowntimeInterval): boolean {
  const aEnd = a.endedAt ? a.endedAt.getTime() : Number.POSITIVE_INFINITY;
  const bEnd = b.endedAt ? b.endedAt.getTime() : Number.POSITIVE_INFINITY;
  return a.startedAt.getTime() < bEnd && b.startedAt.getTime() < aEnd;
}

export function isValidInterval(interval: DowntimeInterval): { valid: boolean; errorKey: 'productionDowntime.endBeforeStart' | 'productionDowntime.durationMustBePositive' | null } {
  if (!isValidDate(interval.startedAt)) return { valid: false, errorKey: 'productionDowntime.endBeforeStart' };
  if (interval.endedAt !== null) {
    if (!isValidDate(interval.endedAt)) return { valid: false, errorKey: 'productionDowntime.endBeforeStart' };
    if (interval.endedAt.getTime() <= interval.startedAt.getTime()) return { valid: false, errorKey: 'productionDowntime.endBeforeStart' };
  }
  if (interval.endedAt && computeDurationMinutes(interval.startedAt, interval.endedAt) <= 0) {
    return { valid: false, errorKey: 'productionDowntime.durationMustBePositive' };
  }
  return { valid: true, errorKey: null };
}

export function isOpenStatus(status: string): boolean {
  return status === 'OPEN';
}

/** Downtime segment lifecycle: OPEN→CLOSED, OPEN→SUPERSEDED, OPEN→CANCELLED, CLOSED→SUPERSEDED. */
export function allowedStatusTransition(from: string, to: string): boolean {
  if (from === to) return false;
  if (from === 'OPEN' && (to === 'CLOSED' || to === 'SUPERSEDED' || to === 'CANCELLED')) return true;
  if (from === 'CLOSED' && to === 'SUPERSEDED') return true;
  return false;
}

export function resolveOccurrenceType(planned: boolean): string {
  return planned ? 'PLANNED' : 'UNPLANNED';
}
