/**
 * Canonical preventive-maintenance schedule due authority (Phase 9).
 *
 * The effective due occurrence is ALWAYS nextDueDate when present, otherwise
 * startDate. Historical startDate is only the cadence origin; it must never
 * make a recurring schedule overdue after a future nextDueDate has been set.
 *
 * Recurrence is anchored to the schedule cadence (startDate day/month and
 * frequency/intervalDays), not to generation wall-clock time. Generation only
 * advances to the first anchored occurrence strictly after the generation
 * boundary, so a late run does not create cumulative drift.
 */

export const DUE_SOON_DAYS = 7;
export const UPCOMING_DAYS = 30;
const DAY_MS = 86400000;

export type ScheduleDueState = 'inactive' | 'expired' | 'overdue' | 'dueSoon' | 'notDue';

export interface ScheduleDueSource {
  status: string;
  startDate: Date | string;
  nextDueDate?: Date | string | null;
  endDate?: Date | string | null;
  frequency?: string | null;
  intervalDays?: number | null;
}

export interface RecurrenceStep {
  kind: 'days' | 'months';
  value: number;
}

export function asDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getEffectiveDueDate(schedule: ScheduleDueSource): Date {
  const nextDue = asDate(schedule.nextDueDate);
  const start = asDate(schedule.startDate);
  if (nextDue) return nextDue;
  if (start) return start;
  throw new Error('MaintenanceSchedule requires a valid startDate');
}

export function getScheduleDueState(schedule: ScheduleDueSource, now: Date = new Date()): ScheduleDueState {
  if (schedule.status !== 'ACTIVE') return 'inactive';

  const endDate = asDate(schedule.endDate);
  if (endDate && endDate.getTime() < now.getTime()) return 'expired';

  const effectiveDue = getEffectiveDueDate(schedule).getTime();
  if (effectiveDue < now.getTime()) return 'overdue';
  if (effectiveDue - now.getTime() <= DUE_SOON_DAYS * DAY_MS) return 'dueSoon';
  return 'notDue';
}

/** Adds the canonical derived fields without mutating the source row. */
export function withDueAuthority<T extends ScheduleDueSource>(schedule: T, now: Date = new Date()): T & { effectiveDueDate: Date; dueStatus: ScheduleDueState } {
  return {
    ...schedule,
    effectiveDueDate: getEffectiveDueDate(schedule),
    dueStatus: getScheduleDueState(schedule, now),
  };
}

/** Prisma predicate for effectiveDueDate <, <=, > or >= a boundary. */
export function effectiveDueCompare(operator: 'lt' | 'lte' | 'gt' | 'gte', boundary: Date): any {
  return {
    OR: [
      { nextDueDate: { [operator]: boundary } },
      { nextDueDate: null, startDate: { [operator]: boundary } },
    ],
  };
}

/** Prisma predicate for effectiveDueDate inside an inclusive range. */
export function effectiveDueBetween(from: Date, to: Date): any {
  return {
    AND: [
      effectiveDueCompare('gte', from),
      effectiveDueCompare('lte', to),
    ],
  };
}

/** Active schedules whose validity period has not ended. */
export function activeNotExpired(now: Date = new Date()): any {
  return {
    status: 'ACTIVE',
    AND: [
      { OR: [{ endDate: null }, { endDate: { gte: now } }] },
    ],
  };
}

export function expiredWhere(now: Date = new Date()): any {
  return { status: 'ACTIVE', endDate: { lt: now } };
}

export function inactiveWhere(): any {
  return { status: { not: 'ACTIVE' } };
}

export function overdueWhere(now: Date = new Date()): any {
  return {
    ...activeNotExpired(now),
    AND: [...activeNotExpired(now).AND, effectiveDueCompare('lt', now)],
  };
}

export function dueSoonWhere(now: Date = new Date(), days: number = DUE_SOON_DAYS): any {
  const horizon = new Date(now.getTime() + days * DAY_MS);
  return {
    ...activeNotExpired(now),
    AND: [...activeNotExpired(now).AND, effectiveDueBetween(now, horizon)],
  };
}

export function notDueWhere(now: Date = new Date(), days: number = DUE_SOON_DAYS): any {
  const horizon = new Date(now.getTime() + days * DAY_MS);
  return {
    ...activeNotExpired(now),
    AND: [...activeNotExpired(now).AND, effectiveDueCompare('gt', horizon)],
  };
}

export function upcomingWhere(now: Date = new Date(), days: number = UPCOMING_DAYS): any {
  const horizon = new Date(now.getTime() + days * DAY_MS);
  return {
    ...activeNotExpired(now),
    AND: [...activeNotExpired(now).AND, effectiveDueBetween(now, horizon)],
  };
}

export function dueStatusWhere(status: string, now: Date = new Date()): any {
  switch (status) {
    case 'inactive': return inactiveWhere();
    case 'expired': return expiredWhere(now);
    case 'overdue': return overdueWhere(now);
    case 'dueSoon': return dueSoonWhere(now);
    case 'notDue': return notDueWhere(now);
    default: return {};
  }
}

/** Optimistic claim: only the caller that sees this exact occurrence may advance it. */
export function generationClaimWhere(schedule: ScheduleDueSource & { id: string }): any {
  return {
    id: schedule.id,
    nextDueDate: schedule.nextDueDate ?? null,
    lastGeneratedAt: (schedule as any).lastGeneratedAt ?? null,
  };
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getRecurrenceStep(schedule: ScheduleDueSource): RecurrenceStep | null {
  if (schedule.intervalDays && schedule.intervalDays > 0) {
    return { kind: 'days', value: schedule.intervalDays };
  }
  switch ((schedule.frequency || '').toUpperCase()) {
    case 'DAILY': return { kind: 'days', value: 1 };
    case 'WEEKLY': return { kind: 'days', value: 7 };
    case 'MONTHLY': return { kind: 'months', value: 1 };
    case 'QUARTERLY': return { kind: 'months', value: 3 };
    case 'YEARLY': return { kind: 'months', value: 12 };
    default: return null;
  }
}

function anchoredOccurrence(startDate: Date, occurrence: Date, step: RecurrenceStep, ordinal: number): Date {
  const hours = occurrence.getHours();
  const minutes = occurrence.getMinutes();
  const seconds = occurrence.getSeconds();
  const millis = occurrence.getMilliseconds();

  if (step.kind === 'days') {
    return new Date(occurrence.getTime() + step.value * ordinal * DAY_MS);
  }

  const occurrenceMonth = occurrence.getFullYear() * 12 + occurrence.getMonth();
  const targetMonth = occurrenceMonth + step.value * ordinal;
  const year = Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const day = Math.min(startDate.getDate(), daysInMonth(year, month));
  return new Date(year, month, day, hours, minutes, seconds, millis);
}

/**
 * Deterministic next occurrence. Starts from the current effective due date,
 * keeps the original cadence anchor (startDate day/month) and advances until
 * the occurrence is strictly after `boundary`. Returns null when the schedule
 * has no supported cadence or the next occurrence is beyond endDate.
 */
export function calculateNextDueDate(
  schedule: ScheduleDueSource,
  boundary: Date = new Date(),
): Date | null {
  const step = getRecurrenceStep(schedule);
  if (!step) return null;

  const startDate = asDate(schedule.startDate);
  const occurrence = getEffectiveDueDate(schedule);
  const endDate = asDate(schedule.endDate);
  if (!startDate) return null;

  let ordinal = 1;
  let candidate = anchoredOccurrence(startDate, occurrence, step, ordinal);
  // Bounded to prevent malformed cadences from looping forever.
  while (candidate.getTime() <= boundary.getTime() && ordinal < 10000) {
    ordinal += 1;
    candidate = anchoredOccurrence(startDate, occurrence, step, ordinal);
  }
  if (endDate && candidate.getTime() > endDate.getTime()) return null;
  return candidate;
}

/** True only when the effective occurrence is currently due for generation. */
export function isGenerationDue(schedule: ScheduleDueSource, now: Date = new Date()): boolean {
  const state = getScheduleDueState(schedule, now);
  return state === 'overdue' || state === 'dueSoon';
}