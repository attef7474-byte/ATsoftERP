/**
 * R2-F — the admin repair-order action matrix must mirror the backend's
 * canonical ALLOWED_TRANSITIONS map exactly.
 *
 * This test parses the real backend service so a change to either side is
 * caught, rather than comparing the UI against a second hand-written copy.
 * An earlier revision of the UI wrongly offered Cancel on IN_INSPECTION, which
 * the API rejects; this is the regression that proves the guard works.
 */
import * as fs from 'fs';
import * as path from 'path';
import { REPAIR_ACTIONS, RepairActionDef } from '../src/app/admin/maintenance/repair-orders/repair-order-actions';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SERVICE_PATH = path.join(
  REPO_ROOT,
  'apps', 'api', 'src', 'modules', 'factory', 'maintenance', 'repair-orders', 'repair-orders.service.ts',
);

function backendSource(): string {
  return fs.readFileSync(SERVICE_PATH, 'utf8');
}

function readBackendTransitions(): Record<string, string[]> {
  const body = backendSource().match(
    /const ALLOWED_TRANSITIONS: Record<string, string\[\]> = \{([\s\S]*?)\n\};/,
  );
  if (!body) throw new Error('could not locate ALLOWED_TRANSITIONS in the repair orders service');
  const map: Record<string, string[]> = {};
  for (const line of body[1].split('\n')) {
    const entry = line.match(/^\s*([A-Z_]+):\s*\[([^\]]*)\]/);
    if (!entry) continue;
    map[entry[1]] = entry[2]
      .split(',')
      .map((value) => value.trim().replace(/^'|'$/g, ''))
      .filter(Boolean);
  }
  if (Object.keys(map).length === 0) throw new Error('ALLOWED_TRANSITIONS parsed to an empty map');
  return map;
}

/**
 * The source states each lifecycle route explicitly accepts, read from the
 * service's own `assertSourceStatus` guards. Two routes can target the same
 * state (startRepair and resumeFromPartsWait both reach UNDER_REPAIR), so the
 * per-route guard — not the transition matrix alone — is what the UI must match.
 */
function readRouteGuards(): Record<string, string[]> {
  const guards: Record<string, string[]> = {};
  for (const match of backendSource().matchAll(
    /\n  async (\w+)\([^)]*\)\s*\{([\s\S]*?)\n  \}\n/g,
  )) {
    const [, method, body] = match;
    const guard = body.match(/assertSourceStatus\(\s*\w+\s*,\s*\[([^\]]*)\]/);
    if (!guard) continue;
    guards[method] = guard[1]
      .split(',')
      .map((value) => value.trim().replace(/^'|'$/g, ''))
      .filter(Boolean);
  }
  return guards;
}

/** The status each UI action drives the order into. */
const TARGET_STATUS: Record<string, string> = {
  open: 'OPEN',
  startInspection: 'IN_INSPECTION',
  recordInspection: 'APPROVED_FOR_REPAIR',
  startRepair: 'UNDER_REPAIR',
  waitForParts: 'WAITING_PARTS',
  resumeFromPartsWait: 'UNDER_REPAIR',
  startTest: 'UNDER_TEST',
  completeServiceable: 'COMPLETED_SERVICEABLE',
  completePartial: 'COMPLETED_PARTIAL',
  completeNotRepairable: 'COMPLETED_NOT_REPAIRABLE',
  scrap: 'SCRAPPED',
  cancel: 'CANCELLED',
};

describe('R2-F repair-order UI action matrix matches the backend state machine', () => {
  const backend = readBackendTransitions();

  it('parses the real backend map', () => {
    expect(Object.keys(backend).sort()).toEqual([
      'APPROVED_FOR_REPAIR', 'CANCELLED', 'COMPLETED_NOT_REPAIRABLE', 'COMPLETED_PARTIAL',
      'COMPLETED_SERVICEABLE', 'DRAFT', 'INSPECTION_FAILED', 'IN_INSPECTION', 'OPEN',
      'SCRAPPED', 'UNDER_REPAIR', 'UNDER_TEST', 'WAITING_PARTS',
    ]);
  });

  it('never offers a source state the backend matrix cannot reach from', () => {
    for (const action of REPAIR_ACTIONS) {
      const target = TARGET_STATUS[action.key];
      for (const status of action.statuses) {
        const reachable = backend[status] ? backend[status].includes(target) : false;
        expect({ key: action.key, status, reachable }).toEqual({ key: action.key, status, reachable: true });
      }
    }
  });

  it('matches the source states each backend route guard accepts', () => {
    const guards = readRouteGuards();
    for (const action of REPAIR_ACTIONS) {
      const guard = guards[action.key];
      if (!guard) continue;
      expect({ key: action.key, statuses: [...action.statuses].sort() }).toEqual({
        key: action.key,
        statuses: [...guard].sort(),
      });
    }
    // The routes the UI offers must actually be guarded in the backend, so a
    // renamed or unguarded route cannot silently slip through.
    expect(Object.keys(guards).sort()).toEqual(
      REPAIR_ACTIONS.map((a) => a.key).filter((k) => guards[k] !== undefined).sort(),
    );
  });

  it('keeps a parts-wait resume distinct from an ordinary repair start', () => {
    const startRepair = REPAIR_ACTIONS.find((a) => a.key === 'startRepair');
    const resume = REPAIR_ACTIONS.find((a) => a.key === 'resumeFromPartsWait');
    expect(startRepair?.statuses).not.toContain('WAITING_PARTS');
    expect(resume?.statuses).toEqual(['WAITING_PARTS']);
    expect(readRouteGuards().startRepair).not.toContain('WAITING_PARTS');
  });

  it('never offers two actions for the same source state and target', () => {
    const pairs = REPAIR_ACTIONS.flatMap((a) =>
      a.statuses.map((status) => `${status}->${TARGET_STATUS[a.key]}`),
    );
    expect(pairs).toEqual([...new Set(pairs)]);
  });

  it('offers no action from a terminal state', () => {
    const terminals = Object.entries(backend).filter(([, targets]) => targets.length === 0).map(([from]) => from);
    expect(terminals.length).toBeGreaterThan(0);
    for (const action of REPAIR_ACTIONS) {
      for (const status of action.statuses) {
        expect(terminals).not.toContain(status);
      }
    }
  });

  it('covers every non-terminal state with at least one action', () => {
    const offered = new Set(REPAIR_ACTIONS.flatMap((a) => a.statuses));
    for (const [status, targets] of Object.entries(backend)) {
      if (targets.length === 0) continue;
      expect({ status, offered: offered.has(status) }).toEqual({ status, offered: true });
    }
  });

  it('uses a unique route segment for every action', () => {
    const routes = REPAIR_ACTIONS.map((a: RepairActionDef) => a.route);
    expect(new Set(routes).size).toBe(routes.length);
  });
});
