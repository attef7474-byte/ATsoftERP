import {
  isReservedDetailRouteId,
  isReservedDetailRouteIdFor,
  RESERVED_DETAIL_ROUTE_SLUGS,
  MODULE_RESERVED_ROUTE_SLUGS,
} from '../src/lib/route-guards';

describe('route-guards — reserved detail-route slugs', () => {
  it('rejects the reserved legacy create slug `new`', () => {
    expect(isReservedDetailRouteId('new')).toBe(true);
  });

  it('allows legitimate detail ids', () => {
    const ids = [
      'adj-001',
      'loc-123',
      'ABC123',
      'machine-categories',
      'by-machine',
      'counts',
      'history',
      'aef2e0059d45d99b96d211557bde97b1c682f614',
    ];
    for (const id of ids) {
      expect(isReservedDetailRouteId(id)).toBe(false);
    }
  });

  it('exposes exactly one global reserved slug', () => {
    expect(Array.from(RESERVED_DETAIL_ROUTE_SLUGS)).toEqual(['new']);
  });
});

describe('route-guards — module-scoped reserved slugs (counts history)', () => {
  it('rejects `history` only for the counts module', () => {
    expect(isReservedDetailRouteIdFor('history', 'inventory-counts')).toBe(true);
  });

  it('does not reject `history` for unrelated modules or globally', () => {
    expect(isReservedDetailRouteIdFor('history', 'maintenance-schedules')).toBe(false);
    expect(isReservedDetailRouteIdFor('history', 'anything-else')).toBe(false);
    expect(isReservedDetailRouteId('history')).toBe(false);
  });

  it('does not reject `new` for counts because counts/new is still an active route', () => {
    expect(isReservedDetailRouteIdFor('new', 'inventory-counts')).toBe(false);
  });

  it('allows legitimate count detail ids (incl. UUIDs and codes)', () => {
    const ids = [
      'cnt-001',
      'counts',
      'aef2e0059d45d99b96d211557bde97b1c682f614',
      '2026-08-29',
    ];
    for (const id of ids) {
      expect(isReservedDetailRouteIdFor(id, 'inventory-counts')).toBe(false);
    }
  });

  it('scopes the counts history reservation narrowly', () => {
    expect(Object.keys(MODULE_RESERVED_ROUTE_SLUGS)).toEqual(['inventory-counts']);
    expect(MODULE_RESERVED_ROUTE_SLUGS['inventory-counts']).toEqual(['history']);
  });
});