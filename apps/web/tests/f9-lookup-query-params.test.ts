import {
  buildLookupQueryParams,
  lookupFilterKey,
  normalizeLookupFilters,
} from '../src/components/f9/lookup-params';

// Mirrors the private buildUrl() serializer in apps/web/src/lib/api.ts so the
// test can assert the exact query string a browser would emit.
function serialize(params: Record<string, string | number>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null) {
      searchParams.set(key, String(value));
    }
  });
  return searchParams.toString();
}

describe('F9 lookup query contract (Defect A regression)', () => {
  const machineId = 'cmunlyq5o0002lc95lfr5stww';

  it('A1 emits the named machineId key', () => {
    const params = buildLookupQueryParams({ machineId }, 1);
    expect(params.machineId).toBe('cmunlyq5o0002lc95lfr5stww');
    expect(Object.keys(params)).toContain('machineId');
  });

  it('A2 emits the named status key', () => {
    const params = buildLookupQueryParams({ status: 'ACTIVE' }, 1);
    expect(params.status).toBe('ACTIVE');
  });

  it('A3 keeps page and limit correct', () => {
    expect(buildLookupQueryParams({ status: 'ACTIVE' }, 3)).toMatchObject({ page: 3, limit: 10 });
    expect(buildLookupQueryParams(undefined, 1, 'pump')).toMatchObject({ page: 1, limit: 10, search: 'pump' });
  });

  it('A4 never emits positional numeric keys 0,1,... (the actual defect)', () => {
    const params = buildLookupQueryParams({ machineId: 'm1', status: 'ACTIVE' }, 1);
    const keys = Object.keys(params);
    expect(keys).not.toContain('0');
    expect(keys).not.toContain('1');
    expect(Object.keys(normalizeLookupFilters({ machineId: 'm1' }))).toEqual(['machineId']);
  });

  it('A4b serializes to named keys instead of "0=machineId,<id>&1=status,ACTIVE"', () => {
    const qs = serialize(buildLookupQueryParams({ machineId: 'm1', status: 'ACTIVE' }, 1, '' as unknown as string));
    expect(qs).toContain('machineId=m1');
    expect(qs).toContain('status=ACTIVE');
    expect(serialize(buildLookupQueryParams({ machineId: 'm1' }, 1))).not.toMatch(/(^|&)0=/);
  });

  it('supports multiple named filters (A5) and omits undefined/empty values (A6)', () => {
    expect(normalizeLookupFilters({ machineId: 'm1', status: 'ACTIVE' })).toEqual({ machineId: 'm1', status: 'ACTIVE' });
    expect(normalizeLookupFilters({ machineId: undefined as unknown as string, status: '', sparePartId: 'sp1' })).toEqual({ sparePartId: 'sp1' });
    const params = buildLookupQueryParams({ machineId: undefined as unknown as string, status: 'ACTIVE' }, 1);
    expect(Object.keys(params).sort()).toEqual(['limit', 'page', 'status']);
  });

  it('A7 supports existing callers with no filters and adds search only when present', () => {
    expect(buildLookupQueryParams(undefined, 2)).toEqual({ page: 2, limit: 10 });
    expect(buildLookupQueryParams(null, 2, '')).toEqual({ page: 2, limit: 10 });
    expect(buildLookupQueryParams(null, 1, 'pump')).toEqual({ page: 1, limit: 10, search: 'pump' });
  });

  it('produces a stable, order-independent filter key', () => {
    expect(lookupFilterKey({ status: 'ACTIVE', machineId: 'm1' })).toBe(lookupFilterKey({ machineId: 'm1', status: 'ACTIVE' }));
    expect(lookupFilterKey(null)).toBe('{}');
    expect(JSON.parse(lookupFilterKey({ machineId: 'm1' }))).toEqual({ machineId: 'm1' });
  });
});
