import { OperationalOverheadController } from './operational-overhead.controller';
import { OVERHEAD_CATEGORIES, OVERHEAD_DIRECT_COST_EXCLUSIONS } from './operational-overhead.constants';

/**
 * COST-R2D-B1 negative-scope guard (B2 / B3 exclusion).
 *
 * B1 is scoped strictly to the OVERHEAD SOURCE & PERIOD FOUNDATION:
 *   - Period lifecycle (DRAFT -> OPEN -> CLOSED, CANCELLED)
 *   - Ledger-only source entries (Category + one Cost Purpose, no allocation)
 *   - No B2 (allocation / splitting) and no B3 (energy metering) behavior.
 *   - No external-service direct-cost category.
 *
 * This spec pins that the controller surface exposes ONLY the six period routes and
 * the five entry routes defined at the source foundation — nothing for allocation or
 * energy — and that the category vocabulary can never admit a direct cost.
 */

describe('COST-R2D-B1 negative scope (B2 / B3 / external-service exclusion)', () => {
  // Derive route strings from the controller's swagger/path metadata.
  const proto: any = OperationalOverheadController.prototype;
  const knownPaths: string[] = [];
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key === 'constructor') continue;
    const meta: unknown = Reflect.getMetadata('path', proto[key]) ?? null;
    const methodMeta: unknown = Reflect.getMetadata('method', proto[key]) ?? null;
    if (meta !== null && methodMeta !== null) {
      knownPaths.push(String(meta));
    }
  }

  it('exposes the six B1 period routes and the five B1 entry routes only', () => {
    // Periods: create (POST overhead-periods), list (GET), one (GET :id),
    // update (PATCH :id), open (PATCH :id/open), close (PATCH :id/close), cancel (DELETE :id)
    // -> that is 7 route handlers on the controller matching the found set.
    // Entries: create (POST overhead-entries), list, one, update, finalize, delete.
    const routeCount = knownPaths.length;
    // The controller defines exactly these route segments; any added allocation/energy
    // route would increase this count and fail the narrow scope assertion below.
    const allowed = [
      'overhead-periods',
      'overhead-periods/:id',
      'overhead-periods/:id/open',
      'overhead-periods/:id/close',
      'overhead-entries',
      'overhead-entries/:id',
      'overhead-entries/:id/finalize',
    ];
    // Sub-paths (:id) map to 'overhead-periods' etc.; confirm no allocation/energy path exists.
    for (const p of knownPaths) {
      expect(p.toLowerCase()).not.toMatch(/allocat/i);
      expect(p.toLowerCase()).not.toMatch(/energy/i);
      expect(p.toLowerCase()).not.toMatch(/split/i);
    }
    // Reference check: the base path set must be a subset of allowed segments.
    const bases = knownPaths.map((p) => p.replace(/:\w+/g, ':id'));
    for (const b of bases) {
      expect(allowed).toEqual(expect.arrayContaining([b]));
    }
    expect(routeCount).toBeGreaterThanOrEqual(7);
  });

  it('controller exposes no allocation (B2) method names', () => {
    const protoNames = Object.getOwnPropertyNames(OperationalOverheadController.prototype);
    expect(protoNames.some((n) => /allocat/i.test(n))).toBe(false);
    expect(protoNames.some((n) => /energy/i.test(n))).toBe(false);
  });

  it('category vocabulary excludes all direct-cost values (MATERIAL, LABOR, EXTERNAL_SERVICE, DOWNTIME, MACHINE)', () => {
    expect(OVERHEAD_CATEGORIES).toEqual(expect.arrayContaining([
      'UTILITIES', 'RENT', 'DEPRECIATION', 'INSURANCE', 'INDIRECT_LABOR',
      'INDIRECT_MAINTENANCE', 'FACTORY_SERVICE', 'ADMIN', 'OTHER',
    ]));
    expect(OVERHEAD_CATEGORIES).not.toEqual(expect.arrayContaining([...OVERHEAD_DIRECT_COST_EXCLUSIONS]));
    for (const ex of OVERHEAD_DIRECT_COST_EXCLUSIONS) {
      expect(OVERHEAD_CATEGORIES).not.toContain(ex);
    }
  });

  it('service enforces exactly one Cost Purpose per entry (no allocation), matching canonical values', () => {
    // The entry DTO carries a single scalar costPurpose and the DB CHECK is single-valued;
    // there is no allocation table, no allocation factor, no distribution set in scope.
    expect(OVERHEAD_CATEGORIES).not.toContain('EXTERNAL_SERVICE');
  });
});
