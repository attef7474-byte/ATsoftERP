import {
  isReservedDetailRouteId,
  isReservedDetailRouteIdFor,
  RESERVED_DETAIL_ROUTE_SLUGS,
  MODULE_RESERVED_ROUTE_SLUGS,
} from '../src/lib/route-guards';
import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(webRoot, rel), 'utf8');

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

describe('route-guards — final two legacy create routes (requests/new, tasks/new)', () => {
  it('reserves the `new` slug for both the requests and tasks detail routes', () => {
    expect(isReservedDetailRouteId('new')).toBe(true);
  });

  it('request and task detail pages reject the reserved `new` id before any data fetch', () => {
    const requestDetail = read('src/app/admin/maintenance/requests/[id]/page.tsx');
    const taskDetail = read('src/app/admin/maintenance/tasks/[id]/page.tsx');
    for (const content of [requestDetail, taskDetail]) {
      expect(content).toContain('isReservedDetailRouteId');
      expect(content).toContain('notFound()');
    }
  });

  it('normal request and task ids are not reserved', () => {
    const normalIds = ['req-001', 'tsk-123', 'aef2e0059d45d99b96d211557bde97b1c682f614'];
    for (const id of normalIds) {
      expect(isReservedDetailRouteId(id)).toBe(false);
    }
  });
});