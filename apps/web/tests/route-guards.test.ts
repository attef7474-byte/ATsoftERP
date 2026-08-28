import { isReservedDetailRouteId, RESERVED_DETAIL_ROUTE_SLUGS } from '../src/lib/route-guards';

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

  it('exposes exactly one reserved slug', () => {
    expect(Array.from(RESERVED_DETAIL_ROUTE_SLUGS)).toEqual(['new']);
  });
});