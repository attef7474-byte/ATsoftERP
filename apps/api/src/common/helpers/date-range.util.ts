import { BadRequestException } from '@nestjs/common';

/**
 * Date-range semantics shared by read-only list/report endpoints.
 *
 * A date-only upper bound (`YYYY-MM-DD`) is inclusive of the whole selected
 * calendar day. It is translated into an exclusive next-day lower boundary
 * (`lt startOfDay(dateTo + 1)`) so later same-day rows are not dropped by the
 * previous `lte midnight` behaviour. Full timestamps keep their exact `lte`
 * meaning.
 */
export interface DateRangeFilter {
  gte?: Date;
  lte?: Date;
  lt?: Date;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnlyString(value: string): boolean {
  return DATE_ONLY_PATTERN.test(value);
}

/**
 * Parses a date-only value as UTC start-of-day, matching the established
 * convention of `new Date('YYYY-MM-DD')` used across the API. Returns an
 * Invalid Date when the calendar date does not exist (for example 2026-02-31),
 * so callers can reject it explicitly instead of silently rolling over.
 */
export function parseDateOnlyStart(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return new Date(NaN);
  }
  return parsed;
}

function parseBound(value: string): Date {
  return isDateOnlyString(value) ? parseDateOnlyStart(value) : new Date(value);
}

export function buildDateRange(
  dateFrom?: string,
  dateTo?: string,
): DateRangeFilter | null {
  if (!dateFrom && !dateTo) return null;

  const range: DateRangeFilter = {};
  if (dateFrom) range.gte = parseBound(dateFrom);
  if (dateTo) {
    if (isDateOnlyString(dateTo)) {
      const nextDay = parseDateOnlyStart(dateTo);
      if (!Number.isNaN(nextDay.getTime())) {
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      }
      range.lt = nextDay;
    } else {
      range.lte = new Date(dateTo);
    }
  }
  return range;
}

export function assertValidDateRange(
  dateFrom?: string,
  dateTo?: string,
): void {
  const from = dateFrom ? parseBound(dateFrom) : null;
  const to = dateTo ? parseBound(dateTo) : null;

  if (from && Number.isNaN(from.getTime())) {
    throw new BadRequestException('Invalid dateFrom value');
  }
  if (to && Number.isNaN(to.getTime())) {
    throw new BadRequestException('Invalid dateTo value');
  }
  if (from && to && from.getTime() > to.getTime()) {
    throw new BadRequestException('dateFrom must not be after dateTo');
  }
}
