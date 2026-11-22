import { BadRequestException } from '@nestjs/common';

/** Current checklist result-type authority shared by templates and executions. */
export const CHECKLIST_RESULT_TYPES = ['PASS_FAIL', 'TEXT', 'NUMBER', 'BOOLEAN', 'READING'] as const;
export const NUMERIC_CHECKLIST_RESULT_TYPES = ['NUMBER', 'READING'] as const;

export interface ChecklistItemConfigInput {
  title?: string | null;
  description?: string | null;
  resultType?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  unit?: string | null;
  sortOrder?: number | null;
}

export interface NormalizedChecklistItemConfig {
  title?: string;
  description: string | null;
  resultType: string;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
}

function fail(keys: string[]): never {
  throw new BadRequestException({
    messageKey: keys[0],
    message: keys.join(', '),
    params: { keys: keys.join(',') },
  });
}

/**
 * Validates a checklist template item against the current enums and rules.
 * `patch = true` allows an omitted title for partial standalone updates; the
 * unified schedule editor always sends a complete item and uses patch = false.
 */
export function normalizeChecklistItemConfig(
  input: ChecklistItemConfigInput,
  patch = false,
): NormalizedChecklistItemConfig {
  const errors: string[] = [];
  if (!patch || input.title !== undefined) {
    if (typeof input.title !== 'string' || input.title.trim().length === 0) {
      errors.push('maintenance.checklistItemTitleRequired');
    }
  }
  if (input.resultType !== undefined && input.resultType !== null
      && !(CHECKLIST_RESULT_TYPES as readonly string[]).includes(input.resultType)) {
    errors.push('maintenance.invalidResultType');
  }
  const isNumeric = !!input.resultType
    && (NUMERIC_CHECKLIST_RESULT_TYPES as readonly string[]).includes(input.resultType);
  const hasMin = input.minValue !== undefined && input.minValue !== null;
  const hasMax = input.maxValue !== undefined && input.maxValue !== null;
  if (!isNumeric && (hasMin || hasMax)) {
    errors.push('maintenance.resultRangeNotApplicable');
  }
  const min = hasMin ? Number(input.minValue) : null;
  const max = hasMax ? Number(input.maxValue) : null;
  if (hasMin && hasMax && (!Number.isFinite(min as number) || !Number.isFinite(max as number))) {
    errors.push('maintenance.invalidResultRange');
  } else if (min !== null && max !== null && min > max) {
    errors.push('maintenance.invalidResultRange');
  }
  if (errors.length) fail(errors);
  return {
    title: typeof input.title === 'string' ? input.title.trim() : undefined,
    description: input.description ?? null,
    resultType: input.resultType ?? 'PASS_FAIL',
    minValue: min,
    maxValue: max,
    unit: input.unit ?? null,
  };
}

/**
 * Produces a stable, unique sortOrder for a complete template item list.
 * Client array position is authoritative; an explicit integer is honoured only
 * when it is unique, otherwise the position is used. No duplicates are emitted.
 */
export function withDeterministicSortOrder<T extends { sortOrder?: number | null }>(
  items: T[],
): Array<T & { sortOrder: number }> {
  const used = new Set<number>();
  return items.map((item, index) => {
    const fallback = index + 1;
    const candidate = Number.isInteger(item.sortOrder) && Number(item.sortOrder) >= 0
      ? Number(item.sortOrder)
      : fallback;
    let order = candidate;
    while (used.has(order)) order += 1;
    used.add(order);
    return { ...item, sortOrder: order };
  });
}
