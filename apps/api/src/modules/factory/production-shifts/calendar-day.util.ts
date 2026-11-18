export interface CalendarShift {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
}
interface ShiftDay {
  isWorkDay: boolean;
  shiftId: string | null;
  shift: CalendarShift | null;
}

/** Shared calendar precedence without the audited interactive resolve action. */
export function resolveCalendarDay(entry: ShiftDay | null | undefined, templateDay: ShiftDay | null | undefined, hasTemplate: boolean) {
  const day = entry ?? templateDay;
  return {
    source: entry ? 'ENTRY' : hasTemplate ? 'TEMPLATE' : 'NONE',
    isWorkDay: Boolean(day?.isWorkDay),
    shift: day?.isWorkDay && day.shiftId ? day.shift : null
  };
}
