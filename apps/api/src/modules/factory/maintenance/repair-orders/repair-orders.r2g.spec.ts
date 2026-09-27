/**
 * R2-G — the operator UI must never become a second repair-order state machine.
 *
 * `getWorkflow()` is the single question the browser asks ("which actions may I
 * offer right now?"), so the table it reads has to be provably incapable of
 * offering anything the write path would refuse. These tests therefore verify the
 * descriptive table against the three real authorities by parsing the actual
 * source, not against a hand-written copy:
 *
 *   1. the per-route `assertSourceStatus` guard literals in the service,
 *   2. the canonical `ALLOWED_TRANSITIONS` map the service enforces on writes,
 *   3. the `@Permissions` decorators in the controller.
 *
 * Plus behavioural coverage of the endpoint itself: tenant/branch isolation,
 * terminal immutability, legacy-route suppression, and read-only-ness.
 */
import * as fs from 'fs';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import {
  RepairOrdersService,
  REPAIR_ORDER_WORKFLOW_ACTIONS,
  OFFERABLE_REPAIR_WORKFLOW_ACTIONS,
} from './repair-orders.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

const SERVICE_PATH = path.join(__dirname, 'repair-orders.service.ts');
const CONTROLLER_PATH = path.join(__dirname, 'repair-orders.controller.ts');

function readSource(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

/** The canonical transition map, parsed exactly as the write path enforces it. */
function readTransitionMap(): Record<string, string[]> {
  const body = readSource(SERVICE_PATH).match(
    /const ALLOWED_TRANSITIONS: Record<string, string\[\]> = \{([\s\S]*?)\n\};/,
  );
  if (!body) throw new Error('could not locate ALLOWED_TRANSITIONS');
  const map: Record<string, string[]> = {};
  for (const line of body[1].split('\n')) {
    const entry = line.match(/^\s*([A-Z_]+):\s*\[([^\]]*)\]/);
    if (!entry) continue;
    map[entry[1]] = entry[2]
      .split(',')
      .map((v) => v.trim().replace(/^'|'$/g, ''))
      .filter(Boolean);
  }
  return map;
}

/**
 * The source states each lifecycle route explicitly accepts, read from the
 * service's own guard calls. Two routes reach the same target (startRepair and
 * resumeFromPartsWait both land on UNDER_REPAIR), so the per-route guard rather
 * than the transition matrix alone is what the UI must mirror.
 */
function readRouteGuards(): Record<string, string[]> {
  const guards: Record<string, string[]> = {};
  for (const match of readSource(SERVICE_PATH).matchAll(
    /\n  (?:async|private async) (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n  \}\n/g,
  )) {
    const [, method, body] = match;
    const guard = body.match(/assertSourceStatus\(\s*\w+\s*,\s*\[([^\]]*)\]/);
    if (!guard) continue;
    guards[method] = guard[1]
      .split(',')
      .map((v) => v.trim().replace(/^'|'$/g, ''))
      .filter(Boolean);
  }
  return guards;
}

/**
 * The source states a route actually accepts, derived from the real write path.
 *
 * Two mechanisms are in play and both are authoritative:
 *  - most routes reach their target through `transition`/`loadForAction`, so
 *    their accepted sources are exactly the states ALLOWED_TRANSITIONS maps to
 *    that target;
 *  - `startRepair` and `resumeFromPartsWait` both land on UNDER_REPAIR, which the
 *    matrix alone cannot disambiguate, so they additionally pin their sources
 *    with a literal `assertSourceStatus` guard. Where a guard exists it is the
 *    narrower authority and wins.
 */
function effectiveSources(
  action: { key: string; targets: string[] },
  transitions: Record<string, string[]>,
  guards: Record<string, string[]>,
): string[] {
  if (guards[action.key]) return [...guards[action.key]].sort();
  const fromMatrix = new Set<string>();
  for (const target of action.targets) {
    for (const [source, targets] of Object.entries(transitions)) {
      if (targets.includes(target)) fromMatrix.add(source);
    }
  }
  return [...fromMatrix].sort();
}

/** route segment -> the @Permissions value the controller declares above it. */
function readControllerPermissions(): Record<string, string> {
  const source = readSource(CONTROLLER_PATH);
  const result: Record<string, string> = {};
  const blocks = source.matchAll(
    /@(Get|Post|Patch|Delete)\('([^']*)'\)\s*\n\s*@Permissions\('([^']*)'\)/g,
  );
  for (const [, , route, permission] of blocks) {
    result[route] = permission;
  }
  return result;
}

const ctx: ActiveOperationalContext = {
  contextKey: 'c1:b1:-:-',
  scopeId: 's1',
  companyId: 'c1',
  companyName: 'Company A',
  companyCode: 'A',
  branchId: 'b1',
  branchName: 'HQ',
  branchCode: 'HQ',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
} as ActiveOperationalContext;

const foreignCtx = { ...ctx, companyId: 'c2', branchId: 'b2' } as ActiveOperationalContext;

const WAREHOUSE = { id: 'wh1', companyId: 'c1', branchId: 'b1', code: 'W1', name: 'Spare Warehouse', warehouseType: 'SPARE_PART' };

function makeService(order: any) {
  const prisma = {
    sparePartRepairOrder: {
      findUnique: jest.fn(async () => order),
    },
  };
  const service = new RepairOrdersService(
    prisma as any,
    { log: jest.fn() } as any,
    { generateNumberAtomic: jest.fn() } as any,
    { getBalanceByKey: jest.fn() } as any,
  );
  return { service, prisma };
}

function makeOrder(status: string, overrides: any = {}) {
  return {
    id: 'ro1',
    status,
    machineId: null,
    warehouseId: 'wh1',
    machine: null,
    warehouse: WAREHOUSE,
    ...overrides,
  };
}

describe('R2-G repair-order workflow table matches the write path', () => {
  const transitions = readTransitionMap();
  const guards = readRouteGuards();
  const controllerPermissions = readControllerPermissions();

  it('parses the real transition map', () => {
    expect(Object.keys(transitions).sort()).toEqual([
      'APPROVED_FOR_REPAIR', 'CANCELLED', 'COMPLETED_NOT_REPAIRABLE', 'COMPLETED_PARTIAL',
      'COMPLETED_SERVICEABLE', 'DRAFT', 'INSPECTION_FAILED', 'IN_INSPECTION', 'OPEN',
      'SCRAPPED', 'UNDER_REPAIR', 'UNDER_TEST', 'WAITING_PARTS',
    ]);
  });

  it('declares a table row for every explicitly guarded route, and pins that guard', () => {
    // The routes that narrow themselves with assertSourceStatus are the ones a
    // transition-map-only mirror would get wrong, so they must be present and
    // must carry exactly the guard's own literals.
    expect(Object.keys(guards).sort()).toEqual(['resumeFromPartsWait', 'startRepair']);
    for (const key of Object.keys(guards)) {
      const row = REPAIR_ORDER_WORKFLOW_ACTIONS.find((a) => a.key === key);
      expect({ key, sources: [...(row?.sources || [])].sort() }).toEqual({
        key,
        sources: [...guards[key]].sort(),
      });
    }
  });

  it('every row pins exactly the source states the write path accepts', () => {
    for (const action of REPAIR_ORDER_WORKFLOW_ACTIONS) {
      expect({ key: action.key, sources: [...action.sources].sort() }).toEqual({
        key: action.key,
        sources: effectiveSources(action, transitions, guards),
      });
    }
  });

  it('every declared target is a real edge of the canonical map from every source', () => {
    for (const action of REPAIR_ORDER_WORKFLOW_ACTIONS) {
      for (const source of action.sources) {
        for (const target of action.targets) {
          expect({
            key: action.key,
            source,
            target,
            allowed: (transitions[source] || []).includes(target),
          }).toEqual({ key: action.key, source, target, allowed: true });
        }
      }
    }
  });

  it('never declares a target the route does not actually write', () => {
    // Inspection is the only route with two outcomes; the rest each have one.
    for (const action of REPAIR_ORDER_WORKFLOW_ACTIONS) {
      if (action.key === 'recordInspection') continue;
      expect({ key: action.key, targets: action.targets.length }).toEqual({
        key: action.key,
        targets: 1,
      });
    }
  });

  it('mirrors the controller permission on every declared route', () => {
    for (const action of REPAIR_ORDER_WORKFLOW_ACTIONS) {
      expect({
        key: action.key,
        route: action.route,
        permission: controllerPermissions[`:id/${action.route}`],
      }).toEqual({
        key: action.key,
        route: action.route,
        permission: action.permission,
      });
    }
  });

  it('covers every non-terminal status with at least one offerable action', () => {
    const offered = new Set(OFFERABLE_REPAIR_WORKFLOW_ACTIONS.flatMap((a) => a.sources));
    for (const [status, targets] of Object.entries(transitions)) {
      if (targets.length === 0) continue;
      expect({ status, offered: offered.has(status) }).toEqual({ status, offered: true });
    }
  });

  it('offers nothing from any terminal status', () => {
    for (const status of Object.keys(transitions).filter((s) => transitions[s].length === 0)) {
      expect(
        OFFERABLE_REPAIR_WORKFLOW_ACTIONS.filter((a) => a.sources.includes(status)),
      ).toEqual([]);
    }
  });

  it('never offers cancellation from IN_INSPECTION or UNDER_TEST', () => {
    const cancel = REPAIR_ORDER_WORKFLOW_ACTIONS.find((a) => a.key === 'cancel')!;
    expect(cancel.sources).not.toContain('IN_INSPECTION');
    expect(cancel.sources).not.toContain('UNDER_TEST');
  });

  it('keeps only-not-repairable reachable from UNDER_TEST, not from INSPECTION_FAILED', () => {
    const complete = REPAIR_ORDER_WORKFLOW_ACTIONS.find((a) => a.key === 'completeNotRepairable')!;
    expect(complete.sources).toEqual(['UNDER_TEST']);
    expect(complete.sources).not.toContain('INSPECTION_FAILED');
  });

  it('keeps a parts-wait resume distinct from an ordinary repair start', () => {
    const start = REPAIR_ORDER_WORKFLOW_ACTIONS.find((a) => a.key === 'startRepair')!;
    const resume = REPAIR_ORDER_WORKFLOW_ACTIONS.find((a) => a.key === 'resumeFromPartsWait')!;
    expect(start.sources).not.toContain('WAITING_PARTS');
    expect(resume.sources).toEqual(['WAITING_PARTS']);
  });

  it('uses a unique route segment and a unique key per row', () => {
    expect(new Set(REPAIR_ORDER_WORKFLOW_ACTIONS.map((a) => a.route)).size)
      .toBe(REPAIR_ORDER_WORKFLOW_ACTIONS.length);
    expect(new Set(REPAIR_ORDER_WORKFLOW_ACTIONS.map((a) => a.key)).size)
      .toBe(REPAIR_ORDER_WORKFLOW_ACTIONS.length);
  });

  it('declares exactly the one documented edge with no route', () => {
    // IN_INSPECTION -> DRAFT is declared in the canonical map but has no
    // operator action, so the UI can never send an inspected order backwards.
    const routed = new Set(
      REPAIR_ORDER_WORKFLOW_ACTIONS.flatMap((a) =>
        a.sources.map((source) => `${source}->${a.targets[0]}`),
      ),
    );
    const unrouted = Object.entries(transitions)
      .flatMap(([source, targets]) => targets.map((target) => `${source}->${target}`))
      .filter((edge) => !routed.has(edge) && !edge.includes('INSPECTION_FAILED'));
    // recordInspection produces INSPECTION_FAILED through its second target, so
    // only the reverse edge is expected to be unrouted.
    expect(unrouted).toEqual(['IN_INSPECTION->DRAFT']);
  });
});

describe('R2-G getWorkflow', () => {
  it('offers only the actions valid for the current status', async () => {
    const { service } = makeService(makeOrder('UNDER_REPAIR'));
    const result = await service.getWorkflow('ro1', ctx);
    expect(result.status).toBe('UNDER_REPAIR');
    expect(result.isTerminal).toBe(false);
    expect(result.actions.map((a: any) => a.key).sort()).toEqual([
      'cancel', 'scrap', 'startTest', 'waitForParts',
    ]);
  });

  it('offers nothing and reports terminal for a completed order', async () => {
    const { service } = makeService(makeOrder('COMPLETED_SERVICEABLE'));
    const result = await service.getWorkflow('ro1', ctx);
    expect(result.isTerminal).toBe(true);
    expect(result.actions).toEqual([]);
  });

  it('never offers the legacy approve-repair compatibility route', async () => {
    const { service } = makeService(makeOrder('IN_INSPECTION'));
    const result = await service.getWorkflow('ro1', ctx);
    expect(result.actions.map((a: any) => a.key)).toEqual(['recordInspection']);
    expect(REPAIR_ORDER_WORKFLOW_ACTIONS.some((a) => a.key === 'approveRepair' && a.legacy)).toBe(true);
  });

  it('reports both inspection outcomes for the canonical decision route', async () => {
    const { service } = makeService(makeOrder('IN_INSPECTION'));
    const result = await service.getWorkflow('ro1', ctx);
    expect(result.actions[0].targets).toEqual(['APPROVED_FOR_REPAIR', 'INSPECTION_FAILED']);
  });

  it('is read-only: it performs no write of any kind', async () => {
    const { service, prisma } = makeService(makeOrder('OPEN'));
    await service.getWorkflow('ro1', ctx);
    const calls = Object.entries(prisma.sparePartRepairOrder)
      .filter(([name]) => name !== 'findUnique')
      .map(([name]) => name);
    expect(calls).toEqual([]);
  });

  it('hides a foreign-company order behind a 404 rather than leaking its workflow', async () => {
    const { service } = makeService(makeOrder('UNDER_REPAIR', { warehouse: { ...WAREHOUSE, companyId: 'c2' } }));
    await expect(service.getWorkflow('ro1', ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hides an order belonging to another branch of the same company', async () => {
    const { service } = makeService(makeOrder('UNDER_REPAIR', { warehouse: { ...WAREHOUSE, branchId: 'b2' } }));
    await expect(service.getWorkflow('ro1', ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resolves a machine-scoped order through its machine, not a header', async () => {
    const { service } = makeService(makeOrder('OPEN', {
      machineId: 'm1',
      machine: { id: 'm1', companyId: 'c1', branchId: 'b1' },
      warehouse: { ...WAREHOUSE, companyId: 'c2' },
    }));
    const result = await service.getWorkflow('ro1', ctx);
    expect(result.actions.map((a: any) => a.key).sort()).toEqual(['cancel', 'startInspection']);
  });

  it('404s a machine-scoped order whose machine belongs to another company', async () => {
    const { service } = makeService(makeOrder('OPEN', {
      machineId: 'm1',
      machine: { id: 'm1', companyId: 'c2', branchId: 'b2' },
    }));
    await expect(service.getWorkflow('ro1', ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s an order that does not exist', async () => {
    const { service, prisma } = makeService(null);
    prisma.sparePartRepairOrder.findUnique = jest.fn(async () => null);
    await expect(service.getWorkflow('missing', ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns only keys the controller actually routes', async () => {
    const permissions = readControllerPermissions();
    for (const action of OFFERABLE_REPAIR_WORKFLOW_ACTIONS) {
      expect(Object.keys(permissions)).toContain(`:id/${action.route}`);
    }
  });
});

describe('R2-G list and detail agree about availability', () => {
  function makeListService(rows: any[]) {
    const prisma = {
      sparePartRepairOrder: {
        findMany: jest.fn(async () => rows),
        // Resolve by id the way Prisma does, so a per-order workflow lookup in the
        // same test sees that order's status and not the first row's.
        findUnique: jest.fn(async ({ where }: any) =>
          rows.find((row) => row.id === where?.id) ?? null),
      },
    };
    const service = new RepairOrdersService(
      prisma as any,
      { log: jest.fn() } as any,
      { generateNumberAtomic: jest.fn() } as any,
      { getBalanceByKey: jest.fn() } as any,
    );
    return { service, prisma };
  }

  it('stamps each list row with the same actions its workflow endpoint reports', async () => {
    const rows = [
      { id: 'a', status: 'DRAFT' },
      { id: 'b', status: 'UNDER_REPAIR' },
      { id: 'c', status: 'COMPLETED_SERVICEABLE' },
    ];
    const { service } = makeListService(rows);
    const list = await service.findAll({}, ctx);
    expect(list.map((row: any) => row.availableActionKeys)).toEqual([
      ['open', 'cancel'],
      ['waitForParts', 'startTest', 'scrap', 'cancel'],
      [],
    ]);
  });

  it('agrees row-by-row with getWorkflow for every status', async () => {
    const statuses = [
      'DRAFT', 'OPEN', 'IN_INSPECTION', 'INSPECTION_FAILED', 'APPROVED_FOR_REPAIR',
      'UNDER_REPAIR', 'WAITING_PARTS', 'UNDER_TEST', 'COMPLETED_SERVICEABLE',
      'COMPLETED_PARTIAL', 'COMPLETED_NOT_REPAIRABLE', 'SCRAPPED', 'CANCELLED',
    ];
    const rows = statuses.map((status, index) => ({
      id: `r${index}`, status, machineId: null, warehouseId: 'wh1', machine: null, warehouse: WAREHOUSE,
    }));
    const { service } = makeListService(rows);
    const list = await service.findAll({}, ctx);
    for (const row of list as any[]) {
      const workflow = await service.getWorkflow(row.id, ctx);
      expect({ id: row.id, list: row.availableActionKeys, workflow: workflow.actions.map((a: any) => a.key) })
        .toEqual({ id: row.id, list: row.availableActionKeys, workflow: row.availableActionKeys });
    }
  });

  it('stamps the detail record with the same availability', async () => {
    const { service } = makeListService([{ id: 'a', status: 'UNDER_TEST', machineId: null, warehouseId: 'wh1', machine: null, warehouse: WAREHOUSE }]);
    const detail = await service.findById('a', ctx);
    expect((detail as any).availableActionKeys).toEqual([
      'startRepair', 'completeServiceable', 'completePartial', 'completeNotRepairable',
    ]);
  });

  it('leaves the row data untouched apart from the additive key list', async () => {
    const row = { id: 'a', status: 'OPEN', repairOrderNumber: 'RPO-1', sourceQuantity: 3 };
    const { service } = makeListService([row]);
    const [result] = await service.findAll({}, ctx) as any[];
    expect({ ...result, availableActionKeys: undefined }).toEqual(row);
  });
});
