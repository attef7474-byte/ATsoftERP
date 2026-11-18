import { Prisma } from '@prisma/client';
import { parseDateOnlyStart } from '../../../common/helpers/date-range.util';
import { resolveCalendarDay } from '../production-shifts/calendar-day.util';
import { UnitOutput } from '../production-runs/production-runs.util';
import { ANALYTICS_TIMEZONE } from './production-analytics.constants';
export type MonitoringClassification = 'MANUFACTURING' | 'PACKAGING' | 'UNCLASSIFIED';
export interface ShiftWindow {
  shiftId: string;
  shiftCode: string;
  shiftName: string;
  from: Date;
  to: Date;
}

// These exact structured codes are seeded by seed-factory-reference.ts.
export function monitoringClassification(code?: string | null): MonitoringClassification {
  if (['MANUFACTURING', 'EXTRUSION', 'FRYING', 'MIXING'].includes(code ?? '')) return 'MANUFACTURING';
  if (['PACKAGING', 'FILLING'].includes(code ?? '')) return 'PACKAGING';
  return 'UNCLASSIFIED';
}
function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ANALYTICS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}
export function businessDate(date: Date): string {
  const parts = localParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function businessInstant(date: string, time = '00:00'): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let result = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = localParts(new Date(result));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    result += desired - represented;
  }
  return new Date(result);
}
export function adjacentBusinessDate(date: string, days: number): string {
  const result = parseDateOnlyStart(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
export function monitoringWindows(now: Date) {
  const today = businessDate(now);
  return {
    today: {
      from: businessInstant(today),
      to: now
    },
    monthToDate: {
      from: businessInstant(`${today.slice(0, 7)}-01`),
      to: now
    }
  };
}
export function resolveMonitoringShift(calendars: any[], shifts: any[], now: Date): {
  currentShift: ShiftWindow | null;
  ambiguous: boolean;
} {
  const today = businessDate(now);
  const candidates = new Map<string, ShiftWindow>();
  for (const date of [adjacentBusinessDate(today, -1), today]) {
    const dateStart = parseDateOnlyStart(date);
    const applicable = calendars.filter(calendar => calendar.effectiveFrom <= dateStart && (!calendar.effectiveTo || calendar.effectiveTo >= dateStart));
    const scheduled = applicable.length ? applicable.map(calendar => {
      const entry = calendar.entries.find((entry: any) => entry.date.toISOString().slice(0, 10) === date);
      const templateDay = calendar.template?.status === 'ACTIVE' && !calendar.template.deletedAt ? calendar.template.days.find((day: any) => day.dayOfWeek === dateStart.getUTCDay()) : null;
      return resolveCalendarDay(entry, templateDay, Boolean(calendar.templateId)).shift;
    }).filter(Boolean) : shifts;
    for (const shift of scheduled as any[]) {
      if (!shifts.some(active => active.id === shift.id)) continue;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(shift.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(shift.endTime)) continue;
      const from = businessInstant(date, shift.startTime);
      const endDate = shift.endTime <= shift.startTime ? adjacentBusinessDate(date, 1) : date;
      const to = businessInstant(endDate, shift.endTime);
      if (from <= now && now < to) candidates.set(`${shift.id}:${from.toISOString()}`, {
        shiftId: shift.id,
        shiftCode: shift.code,
        shiftName: shift.name,
        from,
        to
      });
    }
  }
  return {
    currentShift: candidates.size === 1 ? [...candidates.values()][0] : null,
    ambiguous: candidates.size > 1
  };
}

/** Resource and factory grouping only adds canonical quantities with the same unit. */
export function addUnitOutputs(target: UnitOutput[], values: UnitOutput[]): void {
  for (const value of values) {
    const current = target.find(row => row.unit === value.unit);
    if (!current) {
      target.push({
        ...value
      });
      continue;
    }
    current.quantity = new Prisma.Decimal(current.quantity).plus(value.quantity).toString();
    current.goodQuantity = new Prisma.Decimal(current.goodQuantity).plus(value.goodQuantity).toString();
    current.rejectQuantity = new Prisma.Decimal(current.rejectQuantity).plus(value.rejectQuantity).toString();
  }
  target.sort((a, b) => a.unit.localeCompare(b.unit));
}
