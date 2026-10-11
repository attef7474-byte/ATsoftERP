export type LookupFilterValues = Record<string, string> | null | undefined;

export function normalizeLookupFilters(filters: LookupFilterValues): Record<string, string> {
  if (!filters) return {};
  const entries = Object.entries(filters)
    .filter(([key, value]) => key.length > 0 && value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

export function lookupFilterKey(filters: LookupFilterValues): string {
  return JSON.stringify(normalizeLookupFilters(filters));
}

export function buildLookupQueryParams(
  filters: LookupFilterValues,
  page: number,
  search?: string,
): Record<string, string | number> {
  const params: Record<string, string | number> = { page, limit: 10 };
  if (search) params.search = search;
  Object.entries(normalizeLookupFilters(filters)).forEach(([key, value]) => {
    params[key] = value;
  });
  return params;
}
