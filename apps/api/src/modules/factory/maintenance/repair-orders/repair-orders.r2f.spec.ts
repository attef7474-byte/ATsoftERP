import { BadRequestException } from '@nestjs/common';
import { RepairOrdersService } from './repair-orders.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

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
};

const WAREHOUSE = { id: 'wh1', companyId: 'c1', branchId: 'b1', code: 'W1', name: 'Spare Warehouse', warehouseType: 'SPARE_PART' };
const SPARE = { id: 'sp1', code: 'P1', name: 'Bearing', unit: 'PCS', productId: 'prod1' };

const ALL_STATUSES = [
  'DRAFT', 'OPEN', 'IN_INSPECTION', 'INSPECTION_FAILED', 'APPROVED_FOR_REPAIR',
  'UNDER_REPAIR', 'WAITING_PARTS', 'UNDER_TEST', 'COMPLETED_SERVICEABLE',
  'COMPLETED_PARTIAL', 'COMPLETED_NOT_REPAIRABLE', 'SCRAPPED', 'CANCELLED',
];

const TERMINAL = ['COMPLETED_SERVICEABLE', 'COMPLETED_PARTIAL', 'COMPLETED_NOT_REPAIRABLE', 'SCRAPPED', 'CANCELLED'];

function makeOrder(overrides: any = {}) {
  return {
    id: 'ro1',
    repairOrderNumber: 'RPO-000001',
    sparePartId: 'sp1',
    productId: 'prod1',
    warehouseId: 'wh1',
    sourceCondition: 'USED_REPAIRABLE',
    sourceQuantity: 4,
    reservedQuantity: 4,
    repairedQuantity: 0,
    scrappedQuantity: 0,
    remainingQuantity: 4,
    targetCondition: null,
    status: 'DRAFT',
    sourceType: 'MANUAL_REPAIR_INTAKE',
    sourceId: null,
    maintenanceRequestId: null,
    requiredPartId: null,
    replacementHistoryId: null,
    installedPartId: null,
    conditionInMovementId: null,
    conditionOutMovementId: null,
    inventoryScrapMovementId: null,
    machineId: null,
    machineComponentId: null,
    inspectionResult: null,
    failureDescription: null,
    repairDescription: null,
    testResult: null,
    testNotes: null,
    externalRepair: false,
    externalRepairProviderName: null,
    estimatedRepairCost: null,
    actualRepairCost: null,
    openedByUserId: null,
    inspectedByUserId: null,
    repairedByUserId: null,
    testedByUserId: null,
    closedByUserId: null,
    openedAt: new Date('2026-01-01T00:00:00Z'),
    inspectionStartedAt: null,
    repairStartedAt: null,
    testStartedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelReason: null,
    notes: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

const bkey = (sparePartKey: string, warehouseKey: string, condition: string) => `${sparePartKey}|${warehouseKey}|${condition}`;

function harness(orderOverrides: any = {}, opts: any = {}) {
  const order = makeOrder(orderOverrides);
  const warehouse = opts.warehouse === undefined ? WAREHOUSE : opts.warehouse;
  const movements: any[] = [];
  const actions: any[] = [];
  const auditLog: any[] = [];
  const onHand = opts.onHand ?? 10;

  // Real per-condition balance store so an OUT from USED_REPAIRABLE and an IN to
  // USED_SERVICEABLE move two different rows, exactly as the real schema does
  // (@@unique([sparePartKey, warehouseKey, condition])).
  const balances = new Map<string, any>();
  if (onHand > 0) {
    balances.set(bkey('sp1', 'wh1', 'USED_REPAIRABLE'), {
      id: 'cb-rep', sparePartId: 'sp1', sparePartKey: 'sp1', warehouseId: 'wh1', warehouseKey: 'wh1',
      condition: 'USED_REPAIRABLE', quantity: onHand, availableQuantity: onHand, productId: 'prod1',
    });
  }
  balances.set(bkey('sp1', 'wh1', 'USED_SERVICEABLE'), {
    id: 'cb-svc', sparePartId: 'sp1', sparePartKey: 'sp1', warehouseId: 'wh1', warehouseKey: 'wh1',
    condition: 'USED_SERVICEABLE', quantity: 0, availableQuantity: 0, productId: 'prod1',
  });

  let seq = 0;
  const prisma: any = {
    sparePartRepairOrder: {
      findUnique: jest.fn(async ({ where }: any) =>
        where?.id === order.id ? { ...order, machine: opts.machine ?? null, warehouse } : null),
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => [order]),
      aggregate: jest.fn(async () => ({ _sum: { sourceQuantity: opts.claimed ?? 0 } })),
      create: jest.fn(async ({ data }: any) => { Object.assign(order, data); return { ...order }; }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (order.status !== where.status) return { count: 0 };
        Object.assign(order, data);
        return { count: 1 };
      }),
      update: jest.fn(async ({ data }: any) => { Object.assign(order, data); return { ...order }; }),
      count: jest.fn(async () => 1),
    },
    sparePartConditionBalance: {
      findFirst: jest.fn(async ({ where }: any) => {
        const row = balances.get(bkey(where.sparePartKey, where.warehouseKey, where.condition));
        return row ? { ...row } : null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: 'cb-new', sparePartKey: data.sparePartId, warehouseKey: data.warehouseId,
          quantity: 0, availableQuantity: 0, ...data,
        };
        balances.set(bkey(data.sparePartId, data.warehouseId, data.condition), row);
        return { ...row };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        for (const row of balances.values()) {
          if (row.id === where.id) { Object.assign(row, data); return { ...row }; }
        }
        return null;
      }),
      // R2-F — mirrors SQL Server conditional-update semantics: the `gte`
      // preconditions are part of the same atomic operation as the write, so a
      // row that no longer satisfies them is simply not updated.
      updateMany: jest.fn(async ({ where, data }: any) => {
        for (const row of balances.values()) {
          if (where.id && row.id !== where.id) continue;
          if (where.quantity?.gte !== undefined && row.quantity < where.quantity.gte) return { count: 0 };
          if (where.availableQuantity?.gte !== undefined && row.availableQuantity < where.availableQuantity.gte) return { count: 0 };
          for (const field of ['quantity', 'availableQuantity'] as const) {
            const change = data?.[field];
            if (change?.increment !== undefined) row[field] += change.increment;
            if (change?.decrement !== undefined) row[field] -= change.decrement;
          }
          Object.assign(row, {
            lastMovementAt: data?.lastMovementAt,
            ...(data?.productId ? { productId: data.productId } : {}),
          });
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
    sparePartConditionMovement: {
      create: jest.fn(async ({ data }: any) => {
        const m = { id: 'mv' + (++seq), movementNumber: 'SCM-' + seq, ...data };
        movements.push(m);
        return m;
      }),
    },
    sparePartRepairAction: {
      create: jest.fn(async ({ data }: any) => { const a = { id: 'ac' + (++seq), ...data }; actions.push(a); return a; }),
      findMany: jest.fn(async () => actions),
    },
    sparePart: { findUnique: jest.fn(async ({ where }: any) => (where.id === SPARE.id ? SPARE : null)) },
    warehouse: { findUnique: jest.fn(async ({ where }: any) => (where.id === warehouse?.id ? warehouse : null)) },
    machine: { findUnique: jest.fn(async ({ where }: any) => (opts.machine && where.id === opts.machine.id ? opts.machine : null)) },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };

  const audit = { log: jest.fn(async (...args: any[]) => { auditLog.push(args); }) };
  const numbering = {
    generateNumberAtomicWithClient: jest.fn(async () => 'SCM-TEST-' + seq),
    generateNumberAtomic: jest.fn(async () => 'RPO-TEST'),
  };
  const conditionService = { getBalanceByKey: jest.fn(async () => {
    const row = balances.get(bkey('sp1', 'wh1', order.sourceCondition));
    if (!row) { const e: any = new Error('not found'); throw e; }
    return { ...row };
  }) };

  const service = new RepairOrdersService(prisma as any, audit as any, numbering as any, conditionService as any);
  const bal = (condition: string) => balances.get(bkey('sp1', 'wh1', condition));

  return { service, prisma, order, movements, actions, auditLog, balances, bal, ctx };
}

// ── The action catalogue under test ───────────────────────────────────────
const ACTIONS: Record<string, { dto: any; run: (h: any, dto: any, u: string, c: any) => Promise<any> }> = {
  open:              { dto: {}, run: (h, d, u, c) => h.service.open('ro1', d, u, c) },
  startInspection:   { dto: {}, run: (h, d, u, c) => h.service.startInspection('ro1', d, u, c) },
  inspectionOk:      { dto: { outcome: 'REPAIRABLE', inspectionResult: 'Wear within limits' }, run: (h, d, u, c) => h.service.recordInspectionResult('ro1', d, u, c) },
  inspectionFailed:  { dto: { outcome: 'NOT_REPAIRABLE', inspectionResult: 'Housing cracked', failureDescription: 'Cracked housing' }, run: (h, d, u, c) => h.service.recordInspectionResult('ro1', d, u, c) },
  startRepair:       { dto: {}, run: (h, d, u, c) => h.service.startRepair('ro1', d, u, c) },
  waitForParts:      { dto: { reason: 'Awaiting bearing kit' }, run: (h, d, u, c) => h.service.waitForParts('ro1', d, u, c) },
  resumeFromParts:   { dto: {}, run: (h, d, u, c) => h.service.resumeFromPartsWait('ro1', d, u, c) },
  startTest:         { dto: {}, run: (h, d, u, c) => h.service.startTest('ro1', d, u, c) },
  completeServiceable: { dto: { repairedQuantity: 2, targetCondition: 'USED_SERVICEABLE' }, run: (h, d, u, c) => h.service.completeServiceable('ro1', d, u, c) },
  completePartial:   { dto: { repairedQuantity: 1, scrappedQuantity: 1, targetCondition: 'USED_SERVICEABLE' }, run: (h, d, u, c) => h.service.completePartial('ro1', d, u, c) },
  completeNotRepairable: { dto: { notRepairableQuantity: 2, reason: 'Beyond economic repair' }, run: (h, d, u, c) => h.service.completeNotRepairable('ro1', d, u, c) },
  scrap:             { dto: { scrappedQuantity: 1 }, run: (h, d, u, c) => h.service.scrap('ro1', d, u, c) },
  cancel:            { dto: { reason: 'Duplicate intake' }, run: (h, d, u, c) => h.service.cancel('ro1', d, u, c) },
};

/**
 * The canonical transition matrix. `legal` lists the actions that must succeed
 * from that state, and the value is the status the order must end up in. Every
 * action not listed for a state must be rejected.
 */
const MATRIX: Record<string, Record<string, string>> = {
  DRAFT:                { open: 'OPEN', cancel: 'CANCELLED' },
  OPEN:                 { startInspection: 'IN_INSPECTION', cancel: 'CANCELLED' },
  IN_INSPECTION:        { inspectionOk: 'APPROVED_FOR_REPAIR', inspectionFailed: 'INSPECTION_FAILED' },
  INSPECTION_FAILED:    { scrap: 'SCRAPPED', cancel: 'CANCELLED' },
  APPROVED_FOR_REPAIR:  { startRepair: 'UNDER_REPAIR', cancel: 'CANCELLED' },
  UNDER_REPAIR:         { startTest: 'UNDER_TEST', waitForParts: 'WAITING_PARTS', scrap: 'SCRAPPED', cancel: 'CANCELLED' },
  WAITING_PARTS:        { resumeFromParts: 'UNDER_REPAIR', cancel: 'CANCELLED' },
  UNDER_TEST:           {
    completeServiceable: 'COMPLETED_SERVICEABLE',
    completePartial: 'COMPLETED_PARTIAL',
    completeNotRepairable: 'COMPLETED_NOT_REPAIRABLE',
    startRepair: 'UNDER_REPAIR',
  },
  COMPLETED_SERVICEABLE: {},
  COMPLETED_PARTIAL: {},
  COMPLETED_NOT_REPAIRABLE: {},
  SCRAPPED: {},
  CANCELLED: {},
};

const CASES: Array<[string, string]> = [];
for (const status of ALL_STATUSES) {
  for (const action of Object.keys(ACTIONS)) {
    CASES.push([status, action]);
  }
}

describe('R2-F RepairOrdersService — canonical state machine matrix', () => {
  it('covers every modelled status and every action exactly once', () => {
    expect(CASES).toHaveLength(ALL_STATUSES.length * Object.keys(ACTIONS).length);
    expect(Object.keys(MATRIX).sort()).toEqual([...ALL_STATUSES].sort());
  });

  it.each(CASES)('from %s, action %s resolves to the canonical outcome', async (status, action) => {
    const expected = MATRIX[status][action];
    const h = harness({ status });
    const { dto, run } = ACTIONS[action];

    if (expected === undefined) {
      await expect(run(h, { ...dto }, 'user-1', ctx)).rejects.toBeInstanceOf(BadRequestException);
      // a rejected action must not move the order
      expect(h.order.status).toBe(status);
      return;
    }

    await run(h, { ...dto }, 'user-1', ctx);
    expect(h.order.status).toBe(expected);
  });
});

describe('R2-F — previously unreachable lifecycle edges are now reachable', () => {
  it('DRAFT -> OPEN is produced by the open action and stamps the opener', async () => {
    const h = harness({ status: 'DRAFT' });
    await h.service.open('ro1', { notes: 'ready' }, 'user-1', ctx);
    expect(h.order.status).toBe('OPEN');
    expect(h.order.openedByUserId).toBe('user-1');
    expect(h.order.notes).toBe('ready');
    expect(h.auditLog.length).toBe(1);
  });

  it('IN_INSPECTION -> INSPECTION_FAILED persists the verdict and the failure', async () => {
    const h = harness({ status: 'IN_INSPECTION' });
    await h.service.recordInspectionResult(
      'ro1', { outcome: 'NOT_REPAIRABLE', inspectionResult: 'Housing cracked', failureDescription: 'Cracked housing' }, 'user-1', ctx);
    expect(h.order.status).toBe('INSPECTION_FAILED');
    expect(h.order.inspectionResult).toBe('Housing cracked');
    expect(h.order.failureDescription).toBe('Cracked housing');
    expect(h.order.inspectedByUserId).toBe('user-1');
  });

  it('IN_INSPECTION -> APPROVED_FOR_REPAIR persists the repairable verdict', async () => {
    const h = harness({ status: 'IN_INSPECTION' });
    await h.service.recordInspectionResult(
      'ro1', { outcome: 'REPAIRABLE', inspectionResult: 'Wear within limits' }, 'user-1', ctx);
    expect(h.order.status).toBe('APPROVED_FOR_REPAIR');
    expect(h.order.inspectionResult).toBe('Wear within limits');
  });

  it('UNDER_REPAIR -> WAITING_PARTS requires a reason and records the pause as an action', async () => {
    const h = harness({ status: 'UNDER_REPAIR' });
    await h.service.waitForParts('ro1', { reason: 'Awaiting bearing kit' }, 'user-1', ctx);
    expect(h.order.status).toBe('WAITING_PARTS');
    expect(h.actions).toHaveLength(1);
    expect(h.actions[0].actionType).toBe('NOTE');
    expect(h.actions[0].description).toBe('Awaiting bearing kit');
  });

  it('WAITING_PARTS -> UNDER_REPAIR resumes only from WAITING_PARTS', async () => {
    const paused = harness({ status: 'WAITING_PARTS' });
    await paused.service.resumeFromPartsWait('ro1', {}, 'user-1', ctx);
    expect(paused.order.status).toBe('UNDER_REPAIR');

    const underRepair = harness({ status: 'UNDER_REPAIR' });
    await expect(underRepair.service.resumeFromPartsWait('ro1', {}, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(underRepair.order.status).toBe('UNDER_REPAIR');
  });

  it('the legacy approve-repair route now records an inspection verdict too', async () => {
    const h = harness({ status: 'IN_INSPECTION' });
    await h.service.approveRepair('ro1', {}, 'user-1', ctx);
    expect(h.order.status).toBe('APPROVED_FOR_REPAIR');
    expect(h.order.inspectionResult).toBe('REPAIRABLE');
  });
});

describe('R2-F — completion no longer bypasses the state machine', () => {
  const illegalSources = ['DRAFT', 'OPEN', 'IN_INSPECTION', 'INSPECTION_FAILED', 'APPROVED_FOR_REPAIR', 'WAITING_PARTS', 'UNDER_REPAIR'];
  // scrap has its own narrower set: the canonical map allows it from
  // INSPECTION_FAILED and UNDER_REPAIR only, so those two are absent here.
  const illegalScrapSources = ['DRAFT', 'OPEN', 'IN_INSPECTION', 'APPROVED_FOR_REPAIR', 'WAITING_PARTS', 'UNDER_TEST'];

  it.each(illegalSources)('completeServiceable is rejected from %s', async (status) => {
    const h = harness({ status });
    await expect(h.service.completeServiceable('ro1', { repairedQuantity: 1, targetCondition: 'USED_SERVICEABLE' }, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(h.order.status).toBe(status);
    expect(h.movements).toHaveLength(0);
  });

  it.each(illegalSources)('completePartial is rejected from %s', async (status) => {
    const h = harness({ status });
    await expect(h.service.completePartial('ro1', { repairedQuantity: 1, scrappedQuantity: 1, targetCondition: 'USED_SERVICEABLE' }, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(h.order.status).toBe(status);
    expect(h.movements).toHaveLength(0);
  });

  it.each(illegalScrapSources)('scrap is rejected from %s', async (status) => {
    const h = harness({ status });
    await expect(h.service.scrap('ro1', { scrappedQuantity: 1 }, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(h.order.status).toBe(status);
    expect(h.movements).toHaveLength(0);
  });

  it('scrap is accepted from the two states the matrix allows', async () => {
    for (const status of ['INSPECTION_FAILED', 'UNDER_REPAIR']) {
      const h = harness({ status });
      await h.service.scrap('ro1', { scrappedQuantity: 1, reason: 'beyond repair' }, 'user-1', ctx);
      expect(h.order.status).toBe('SCRAPPED');
    }
  });
});

describe('R2-F — terminal immutability', () => {
  it.each(TERMINAL)('every action is rejected from terminal status %s', async (status) => {
    for (const [name, action] of Object.entries(ACTIONS)) {
      const h = harness({ status });
      await expect(action.run(h, { ...action.dto }, 'user-1', ctx)).rejects.toBeInstanceOf(BadRequestException);
      expect(h.order.status).toBe(status);
      expect(h.movements).toHaveLength(0);
      void name;
    }
  });

  it('re-submitting a completion is rejected instead of double-consuming stock', async () => {
    const h = harness({ status: 'UNDER_TEST' });
    const dto = { repairedQuantity: 2, targetCondition: 'USED_SERVICEABLE' };
    await h.service.completeServiceable('ro1', dto, 'user-1', ctx);
    expect(h.order.status).toBe('COMPLETED_SERVICEABLE');
    const afterFirst = h.bal('USED_REPAIRABLE').quantity;
    await expect(h.service.completeServiceable('ro1', dto, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(h.bal('USED_REPAIRABLE').quantity).toBe(afterFirst);
  });

  it('an unknown current status fails closed', async () => {
    const h = harness({ status: 'LEGACY_IMPORTED_STATE' });
    await expect(h.service.open('ro1', {}, 'user-1', ctx)).rejects.toBeInstanceOf(BadRequestException);
    expect(h.order.status).toBe('LEGACY_IMPORTED_STATE');
  });
});

describe('R2-F — COMPLETED_NOT_REPAIRABLE inventory semantics', () => {
  it('removes the quantity from the source condition and never returns it', async () => {
    const h = harness({ status: 'UNDER_TEST' });
    const before = h.bal('USED_REPAIRABLE').quantity;

    await h.service.completeNotRepairable('ro1', { notRepairableQuantity: 2, reason: 'Beyond economic repair' }, 'user-1', ctx);

    expect(h.order.status).toBe('COMPLETED_NOT_REPAIRABLE');
    expect(h.order.scrappedQuantity).toBe(2);
    expect(h.order.remainingQuantity).toBe(2);
    expect(h.order.reservedQuantity).toBe(0);
    expect(h.order.closedByUserId).toBe('user-1');
    expect(h.order.completedAt).toBeInstanceOf(Date);

    // exactly one OUT movement, and no IN movement at all
    expect(h.movements).toHaveLength(1);
    expect(h.movements[0].direction).toBe('OUT');
    expect(h.movements[0].quantity).toBe(2);
    expect(h.movements[0].sourceType).toBe('REPAIR_NOT_REPAIRABLE');
    expect(h.movements.filter((m: any) => m.direction === 'IN')).toHaveLength(0);

    expect(h.bal('USED_REPAIRABLE').quantity).toBe(before - 2);
    expect(h.bal('USED_SERVICEABLE').quantity).toBe(0);
  });

  it('keeps the inspection verdict and records the test outcome as failure evidence', async () => {
    const h = harness({ status: 'UNDER_TEST', inspectionResult: 'Wear within limits' });
    await h.service.completeNotRepairable('ro1', { notRepairableQuantity: 2, reason: 'Beyond economic repair' }, 'user-1', ctx);

    // The inspection verdict must survive the completion; the reason is separate
    // evidence, not a replacement for what the inspector actually found.
    expect(h.order.inspectionResult).toBe('Wear within limits');
    expect(h.order.failureDescription).toBe('Not repairable after test: Beyond economic repair');
    expect(h.order.inspectionResult).not.toContain('Beyond economic repair');
  });

  it('appends to an existing failure description instead of overwriting it', async () => {
    const h = harness({ status: 'UNDER_TEST', failureDescription: 'Cracked housing' });
    await h.service.completeNotRepairable('ro1', { notRepairableQuantity: 1, reason: 'Beyond economic repair' }, 'user-1', ctx);

    expect(h.order.failureDescription)
      .toBe('Cracked housing | Not repairable after test: Beyond economic repair');
  });

  it('rejects a quantity above the remaining quantity and a missing reason', async () => {
    const h = harness({ status: 'UNDER_TEST' });
    await expect(h.service.completeNotRepairable('ro1', { notRepairableQuantity: 99, reason: 'x' }, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(h.service.completeNotRepairable('ro1', { notRepairableQuantity: 1, reason: '   ' }, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(h.order.status).toBe('UNDER_TEST');
    expect(h.movements).toHaveLength(0);
  });
});

describe('R2-F — quantity and condition-balance invariants', () => {
  it('pins the residual-quantity semantics: a partial completion below the remaining quantity is terminal and returns the untouched units to unreserved stock', async () => {
    // R2-F — documented intent, not an accident. COMPLETED_PARTIAL is terminal
    // and releases the whole claim (reservedQuantity 0), while only the quantity
    // actually converted or scrapped leaves the source pool. The leftover units
    // were never debited, so they become ordinary available stock again and can
    // be picked up by a later repair order. remainingQuantity keeps the residue
    // visible for reporting instead of silently reporting a fully consumed order.
    const h = harness({ status: 'UNDER_TEST' });
    const beforeRepairable = h.bal('USED_REPAIRABLE').quantity;

    await h.service.completePartial('ro1', { repairedQuantity: 2, scrappedQuantity: 1, targetCondition: 'USED_SERVICEABLE' }, 'user-1', ctx);

    expect(h.order.status).toBe('COMPLETED_PARTIAL');
    expect(h.order.repairedQuantity).toBe(2);
    expect(h.order.scrappedQuantity).toBe(1);
    expect(h.order.remainingQuantity).toBe(1);
    expect(h.order.reservedQuantity).toBe(0);

    // 3 of 4 units actually left the source pool; the 4th is untouched.
    expect(h.bal('USED_REPAIRABLE').quantity).toBe(beforeRepairable - 3);
    expect(h.bal('USED_SERVICEABLE').quantity).toBe(2);
  });

  it('completeServiceable converts the condition atomically and releases the claim', async () => {
    const h = harness({ status: 'UNDER_TEST' });
    await h.service.completeServiceable('ro1', { repairedQuantity: 2, targetCondition: 'USED_SERVICEABLE' }, 'user-1', ctx);

    expect(h.order.status).toBe('COMPLETED_SERVICEABLE');
    expect(h.order.repairedQuantity).toBe(2);
    expect(h.order.remainingQuantity).toBe(2);
    expect(h.order.reservedQuantity).toBe(0);
    expect(h.movements.map((m: any) => `${m.direction}:${m.condition}:${m.quantity}`).sort())
      .toEqual(['IN:USED_SERVICEABLE:2', 'OUT:USED_REPAIRABLE:2']);
    expect(h.bal('USED_REPAIRABLE').quantity).toBe(8);
    expect(h.bal('USED_SERVICEABLE').quantity).toBe(2);
  });

  it('rejects a completion that exceeds the remaining quantity', async () => {
    const h = harness({ status: 'UNDER_TEST', remainingQuantity: 2 });
    await expect(h.service.completeServiceable('ro1', { repairedQuantity: 3, targetCondition: 'USED_SERVICEABLE' }, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(h.order.status).toBe('UNDER_TEST');
    expect(h.movements).toHaveLength(0);
  });

  it('rejects a completion that would drive the condition balance negative', async () => {
    const h = harness({ status: 'UNDER_TEST' }, { onHand: 1 });
    await expect(h.service.completeServiceable('ro1', { repairedQuantity: 2, targetCondition: 'USED_SERVICEABLE' }, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(h.order.status).toBe('UNDER_TEST');
    expect(h.movements).toHaveLength(0);
  });

  it('rejects an invalid target condition', async () => {
    const h = harness({ status: 'UNDER_TEST' });
    await expect(h.service.completeServiceable('ro1', { repairedQuantity: 1, targetCondition: 'NEW' }, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(h.movements).toHaveLength(0);
  });

  it('cancellation requires a reason and releases the claim', async () => {
    const h = harness({ status: 'WAITING_PARTS' });
    await expect(h.service.cancel('ro1', { reason: '' }, 'user-1', ctx)).rejects.toBeInstanceOf(BadRequestException);
    expect(h.order.status).toBe('WAITING_PARTS');

    await h.service.cancel('ro1', { reason: 'Duplicate intake' }, 'user-1', ctx);
    expect(h.order.status).toBe('CANCELLED');
    expect(h.order.cancelReason).toBe('Duplicate intake');
    expect(h.order.reservedQuantity).toBe(0);
    expect(h.order.cancelledAt).toBeInstanceOf(Date);
  });
});

describe('R2-F — concurrent completion cannot double-consume the balance', () => {
  it('a second writer that read a stale status is rejected, not applied', async () => {
    const h = harness({ status: 'UNDER_TEST' });
    // Simulate the race: the status precondition in the transaction no longer
    // matches because another writer already moved the order.
    (h.prisma.sparePartRepairOrder.updateMany as jest.Mock).mockImplementationOnce(async () => ({ count: 0 }));

    await expect(h.service.completeServiceable('ro1', { repairedQuantity: 2, targetCondition: 'USED_SERVICEABLE' }, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(h.order.status).toBe('UNDER_TEST');
  });

  it('a concurrent plain transition is also rejected on a stale status', async () => {
    const h = harness({ status: 'DRAFT' });
    (h.prisma.sparePartRepairOrder.updateMany as jest.Mock).mockImplementationOnce(async () => ({ count: 0 }));
    await expect(h.service.open('ro1', {}, 'user-1', ctx)).rejects.toBeInstanceOf(BadRequestException);
    expect(h.order.status).toBe('DRAFT');
  });

  it('the balance write is a conditional update, not a read-modify-write', async () => {
    const h = harness({ status: 'UNDER_TEST' });
    await h.service.completeServiceable('ro1', { repairedQuantity: 2, targetCondition: 'USED_SERVICEABLE' }, 'user-1', ctx);

    // The sufficiency precondition must travel in the `where` clause so SQL
    // Server evaluates the check and the write as one atomic row operation.
    const balanceCalls = (h.prisma.sparePartConditionBalance.updateMany as jest.Mock).mock.calls;
    const decrements = balanceCalls.filter(([arg]: any[]) => arg?.data?.quantity?.decrement !== undefined);
    expect(decrements).toHaveLength(1);
    expect(decrements[0][0].where).toMatchObject({ quantity: { gte: 2 }, availableQuantity: { gte: 2 } });
    expect(decrements[0][0].data).toMatchObject({ quantity: { decrement: 2 }, availableQuantity: { decrement: 2 } });
  });

  it('rejects the movement when the conditional update matches no row', async () => {
    const h = harness({ status: 'UNDER_TEST' });
    // Simulate another writer having drained the row between the read and the
    // write: the conditional update matches nothing even though the earlier
    // read still showed sufficient stock.
    (h.prisma.sparePartConditionBalance.updateMany as jest.Mock).mockImplementationOnce(async () => ({ count: 0 }));

    await expect(h.service.completeServiceable('ro1', { repairedQuantity: 2, targetCondition: 'USED_SERVICEABLE' }, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(h.movements).toHaveLength(0);
    expect(h.order.status).toBe('UNDER_TEST');
  });

  it('a not-repairable completion also uses the atomic decrement', async () => {
    const h = harness({ status: 'UNDER_TEST' });
    await h.service.completeNotRepairable('ro1', { notRepairableQuantity: 2, reason: 'Beyond economic repair' }, 'user-1', ctx);

    const decrements = (h.prisma.sparePartConditionBalance.updateMany as jest.Mock).mock.calls
      .filter(([arg]: any[]) => arg?.data?.quantity?.decrement !== undefined);
    expect(decrements).toHaveLength(1);
    expect(decrements[0][0].where).toMatchObject({ quantity: { gte: 2 }, availableQuantity: { gte: 2 } });
  });
});

describe('R2-F — tenant and branch isolation on every state change', () => {
  it('rejects a foreign-company order for every action', async () => {
    for (const [name, action] of Object.entries(ACTIONS)) {
      const h = harness({ status: 'UNDER_TEST' }, { warehouse: { ...WAREHOUSE, companyId: 'c2' } });
      await expect(action.run(h, { ...action.dto }, 'user-1', ctx)).rejects.toThrow();
      expect(h.order.status).toBe('UNDER_TEST');
      expect(h.movements).toHaveLength(0);
      void name;
    }
  });

  it('rejects a foreign-company order that is machine-scoped, so its warehouse cannot be drained', async () => {
    const h = harness(
      { status: 'UNDER_TEST', machineId: 'm1' },
      { machine: { id: 'm1', companyId: 'c1', branchId: 'b1' }, warehouse: { ...WAREHOUSE, companyId: 'c2' } },
    );
    await expect(h.service.completeServiceable('ro1', { repairedQuantity: 2, targetCondition: 'USED_SERVICEABLE' }, 'user-1', ctx))
      .rejects.toThrow();
    expect(h.order.status).toBe('UNDER_TEST');
    expect(h.movements).toHaveLength(0);
  });

  it('rejects an order from another branch', async () => {
    const h = harness({ status: 'UNDER_TEST' }, { warehouse: { ...WAREHOUSE, branchId: 'b9' } });
    await expect(h.service.completeServiceable('ro1', { repairedQuantity: 1, targetCondition: 'USED_SERVICEABLE' }, 'user-1', ctx))
      .rejects.toThrow();
    expect(h.order.status).toBe('UNDER_TEST');
  });
});

describe('R2-F — reservation / claim invariant on intake', () => {
  const intake = {
    sparePartId: 'sp1',
    warehouseId: 'wh1',
    sourceCondition: 'USED_REPAIRABLE',
    sourceQuantity: 4,
  };

  it('rejects an intake whose claim would exceed the condition stock still on hand', async () => {
    // 7 already claimed of 10 on hand: a further 4 must be refused.
    const h = harness({}, { onHand: 10, claimed: 7 });
    await expect(h.service.create({ ...intake } as any, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(h.prisma.sparePartRepairOrder.create).not.toHaveBeenCalled();
  });

  it('accepts an intake that exactly consumes the remaining unclaimed stock', async () => {
    const h = harness({}, { onHand: 10, claimed: 6 });
    await h.service.create({ ...intake } as any, 'user-1', ctx);
    expect(h.prisma.sparePartRepairOrder.create).toHaveBeenCalledTimes(1);
    expect(h.order.status).toBe('DRAFT');
    expect(h.order.reservedQuantity).toBe(4);
    expect(h.order.remainingQuantity).toBe(4);
  });

  it('scopes the claim to the same spare part, warehouse and condition only', async () => {
    const h = harness({}, { onHand: 10, claimed: 0 });
    await h.service.create({ ...intake } as any, 'user-1', ctx);
    const where = (h.prisma.sparePartRepairOrder.aggregate as jest.Mock).mock.calls[0][0].where;
    expect(where.sparePartId).toBe('sp1');
    expect(where.warehouseId).toBe('wh1');
    expect(where.sourceCondition).toBe('USED_REPAIRABLE');
    // only orders that still hold a claim are counted
    expect(where.status.in).toEqual(expect.arrayContaining(['DRAFT', 'OPEN', 'UNDER_REPAIR', 'WAITING_PARTS', 'UNDER_TEST']));
    expect(where.status.in).not.toEqual(expect.arrayContaining(['CANCELLED', 'SCRAPPED', 'COMPLETED_SERVICEABLE', 'COMPLETED_PARTIAL', 'COMPLETED_NOT_REPAIRABLE']));
  });

  it('a terminal order releases its claim for the next intake', async () => {
    // 6 already claimed by a COMPLETED order must not block anything.
    const h = harness({ status: 'COMPLETED_SERVICEABLE' }, { onHand: 10, claimed: 6 });
    await h.service.create({ ...intake } as any, 'user-1', ctx);
    expect(h.prisma.sparePartRepairOrder.create).toHaveBeenCalled();
  });

  it('still refuses a non-repairable source and a foreign warehouse before any claim is taken', async () => {
    const notRepairable = harness({}, { onHand: 10, claimed: 0 });
    await expect(notRepairable.service.create({ ...intake, sourceCondition: 'NEW' } as any, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(notRepairable.prisma.sparePartRepairOrder.create).not.toHaveBeenCalled();

    const foreign = harness({}, { onHand: 10, claimed: 0, warehouse: { ...WAREHOUSE, companyId: 'c2' } });
    await expect(foreign.service.create({ ...intake } as any, 'user-1', ctx)).rejects.toThrow();
    expect(foreign.prisma.sparePartRepairOrder.create).not.toHaveBeenCalled();
  });

  it('honours the external-repair fields and the estimated cost instead of dropping them', async () => {
    const h = harness({}, { onHand: 10, claimed: 0 });
    await h.service.create({
      ...intake, externalRepair: true, externalRepairProviderName: 'Vendor X', estimatedRepairCost: 250.5,
    } as any, 'user-1', ctx);
    expect(h.order.externalRepair).toBe(true);
    expect(h.order.externalRepairProviderName).toBe('Vendor X');
    expect(String(h.order.estimatedRepairCost)).toContain('250.5');
  });
});

describe('R2-F — action names cannot be used as aliases for a different edge', () => {
  it('resume-from-parts-wait is refused outside WAITING_PARTS', async () => {
    for (const status of ['APPROVED_FOR_REPAIR', 'UNDER_TEST', 'UNDER_REPAIR', 'DRAFT']) {
      const h = harness({ status });
      await expect(h.service.resumeFromPartsWait('ro1', {}, 'user-1', ctx))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(h.order.status).toBe(status);
    }
  });

  it('start-repair is refused for a parts wait, so a resume is never audited as a repair start', async () => {
    const h = harness({ status: 'WAITING_PARTS' });
    await expect(h.service.startRepair('ro1', {}, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(h.order.status).toBe('WAITING_PARTS');
  });

  it('start-repair still works as a rework from UNDER_TEST', async () => {
    const h = harness({ status: 'UNDER_TEST' });
    await h.service.startRepair('ro1', { repairDescription: 'Rework after failed test' }, 'user-1', ctx);
    expect(h.order.status).toBe('UNDER_REPAIR');
    expect(h.order.repairDescription).toBe('Rework after failed test');
  });
});

describe('R2-F — evidence is no longer silently discarded', () => {
  it('start-repair persists the repair description that was previously dropped', async () => {
    const h = harness({ status: 'APPROVED_FOR_REPAIR' });
    await h.service.startRepair('ro1', { repairDescription: 'Replaced inner race', notes: 'per work instruction' }, 'user-1', ctx);
    expect(h.order.status).toBe('UNDER_REPAIR');
    expect(h.order.repairDescription).toBe('Replaced inner race');
    expect(h.order.notes).toBe('per work instruction');
    expect(h.order.repairedByUserId).toBe('user-1');
  });

  it('an inspection verdict without a result is rejected', async () => {
    const h = harness({ status: 'IN_INSPECTION' });
    await expect(h.service.recordInspectionResult('ro1', { outcome: 'REPAIRABLE', inspectionResult: '  ' }, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    const failed = harness({ status: 'IN_INSPECTION' });
    await expect(failed.service.recordInspectionResult('ro1', { outcome: 'NOT_REPAIRABLE', inspectionResult: 'cracked' }, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(h.order.status).toBe('IN_INSPECTION');
  });

  it('a repair action cannot be appended to a terminal order', async () => {
    const h = harness({ status: 'SCRAPPED' });
    await expect(h.service.addAction('ro1', { actionType: 'REPAIR' }, 'user-1', ctx))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(h.actions).toHaveLength(0);
  });
});
