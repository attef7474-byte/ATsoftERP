'use client';

import { ApiFieldError } from './error-utils';

export interface FieldErrorEntry {
  field: string;
  message: string;
}

function getValueAtPath(source: unknown, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split('.');
  let current: unknown = source;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    if (Array.isArray(current) && /^\d+$/.test(part)) {
      current = current[Number(part)];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

export function setValueAtPath(source: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = source;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    const next = current[part];
    if (!next || typeof next !== 'object') {
      const created: Record<string, unknown> = {};
      current[part] = created;
      current = created;
    } else {
      current = next as Record<string, unknown>;
    }
  }
  current[parts[parts.length - 1]] = value;
}

export function hasValueAtPath(source: unknown, path: string): boolean {
  const parts = path.split('.');
  let current: unknown = source;
  for (const part of parts) {
    if (current === null || current === undefined) return false;
    if (typeof current !== 'object') return false;
    if (Array.isArray(current) && /^\d+$/.test(part)) {
      current = current[Number(part)];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
    if (current === undefined || current === null || current === '') return false;
  }
  return true;
}

export function errorsToFieldMap(errors: ApiFieldError[] | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!errors) return map;
  for (const entry of errors) {
    if (!entry.field) continue;
    const message = entry.message || entry.code || '';
    if (message && !map[entry.field]) map[entry.field] = message;
  }
  return map;
}

export function filterStaleErrors(
  errors: ApiFieldError[] | undefined,
  form: Record<string, unknown>,
): ApiFieldError[] | undefined {
  if (!errors || errors.length === 0) return undefined;
  const remaining: ApiFieldError[] = [];
  for (const entry of errors) {
    if (!entry.field) {
      remaining.push(entry);
      continue;
    }
    if (hasValueAtPath(form, entry.field)) continue;
    remaining.push(entry);
  }
  return remaining.length > 0 ? remaining : undefined;
}

export function findFirstInvalidField(errors: ApiFieldError[] | undefined): string | undefined {
  if (!errors) return undefined;
  const entry = errors.find((item) => item.field);
  return entry?.field;
}

export function focusFirstInvalidField(errors: ApiFieldError[] | undefined, rootId = 'content'): void {
  if (typeof document === 'undefined') return;
  const field = findFirstInvalidField(errors);
  if (!field) return;

  const escaped = field.replace(/[[\]."\\]/g, '\\$&');
  const candidates = [
    document.querySelector(`[data-field="${escaped}"]`),
    document.querySelector(`[name="${escaped}"]`),
    document.getElementById(`field-${escaped}`),
  ];
  const element = candidates.find((node): node is HTMLElement => node instanceof HTMLElement);

  if (element) {
    const focusable = element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement
      ? element
      : element.querySelector<HTMLElement>('input, select, textarea');
    const target = focusable ?? element;
    target.focus({ preventScroll: false });
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const container = document.getElementById(rootId) ?? document.body;
  const firstInput = container.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])');
  if (firstInput) {
    firstInput.focus({ preventScroll: false });
    firstInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

export function mapEntityIdField(fieldName: string): string {
  if (fieldName === 'id') return 'id';
  if (fieldName.endsWith('Id')) return `${fieldName.slice(0, -2)}IdLookup`;
  return fieldName;
}

export function adaptFieldErrorsToMap(
  errors: ApiFieldError[] | undefined,
  idFieldMap: Record<string, string> = {},
): Record<string, string> {
  const map: Record<string, string> = {};
  if (!errors) return map;
  for (const entry of errors) {
    if (!entry.field) continue;
    const mapped = idFieldMap[entry.field] || entry.field;
    const message = entry.message || entry.code || '';
    if (message && !map[mapped]) map[mapped] = message;
  }
  return map;
}

export { getValueAtPath };
