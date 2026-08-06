export interface Interval {
  start: Date;
  end: Date;
}

function asDate(input: Date): Date {
  return input;
}

/** Merges overlapping/touching intervals; input intervals with end <= start are dropped. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((interval) => interval.end.getTime() > interval.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start.getTime() <= last.end.getTime()) {
      if (interval.end.getTime() > last.end.getTime()) last.end = interval.end;
    } else {
      merged.push({ start: asDate(interval.start), end: asDate(interval.end) });
    }
  }
  return merged;
}

/** Sweep-line intersection of two interval sets. Both are treated as merged beforehand. */
export function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const left = mergeIntervals(a);
  const right = mergeIntervals(b);
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const lo = left[i].start.getTime() > right[j].start.getTime() ? left[i].start : right[j].start;
    const hi = left[i].end.getTime() < right[j].end.getTime() ? left[i].end : right[j].end;
    if (hi.getTime() > lo.getTime()) out.push({ start: lo, end: hi });
    if (left[i].end.getTime() < right[j].end.getTime()) i += 1;
    else j += 1;
  }
  return out;
}

export function totalDurationMinutes(intervals: Interval[]): number {
  return intervals.reduce((sum, interval) => sum + (interval.end.getTime() - interval.start.getTime()) / 60000, 0);
}

export function clampToPeriod(intervals: Interval[], from: Date, to: Date): Interval[] {
  return intervals
    .map((interval) => {
      const start = interval.start.getTime() > from.getTime() ? interval.start : from;
      const end = interval.end.getTime() < to.getTime() ? interval.end : to;
      return { start, end };
    })
    .filter((interval) => interval.end.getTime() > interval.start.getTime());
}

/** Total minutes of A that also falls inside B, after both are clamped/merged. */
export function intersectionMinutes(a: Interval[], b: Interval[]): number {
  return totalDurationMinutes(intersectIntervals(a, b));
}
