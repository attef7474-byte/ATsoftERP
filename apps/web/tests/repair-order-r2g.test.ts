/**
 * R2-G — the operator UI must be a strict projection of the backend workflow.
 *
 * The R2-F suite proves the frontend matrix mirrors `ALLOWED_TRANSITIONS`. R2-G
 * added a published workflow description (`REPAIR_ORDER_WORKFLOW_ACTIONS`) that
 * the API returns to the browser, so the UI now reads availability from the
 * server instead of recomputing it. That shifts the risk: the two tables can
 * drift apart silently, and a shorthand permission can reach the exact-match
 * `can()` and hide every action from a legitimate operator.
 *
 * These tests parse the real backend service, so a change on either side fails
 * here rather than in a browser.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  REPAIR_ACTIONS,
  REPAIR_ACTION_BY_KEY,
  RepairFormState,
  allRepairPermissionKeys,
  buildRepairPayload,
  canRunRepairAction,
  effectiveRepairPermissions,
  offerableRepairActions,
  repairableRowCanCreate,
  repairActionDef,
  repairActionPermissionKey,
} from '../src/app/admin/maintenance/repair-orders/repair-order-actions';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SERVICE_PATH = path.join(
  REPO_ROOT,
  'apps', 'api', 'src', 'modules', 'factory', 'maintenance', 'repair-orders', 'repair-orders.service.ts',
);
const CONTROLLER_PATH = path.join(
  REPO_ROOT,
  'apps', 'api', 'src', 'modules', 'factory', 'maintenance', 'repair-orders', 'repair-orders.controller.ts',
);

interface BackendWorkflowAction {
  key: string;
  route: string;
  permission: string;
  sources: string[];
  targets: string[];
  requiresInput: boolean;
  legacy?: boolean;
  danger?: boolean;
}

function readBackendWorkflowActions(): BackendWorkflowAction[] {
  const source = fs.readFileSync(SERVICE_PATH, 'utf8');
  const table = source.match(
    /const REPAIR_ORDER_WORKFLOW_ACTIONS: RepairOrderWorkflowAction\[\] = \[([\s\S]*?)\n\];/,
  );
  if (!table) throw new Error('could not locate REPAIR_ORDER_WORKFLOW_ACTIONS in the repair orders service');

  const actions: BackendWorkflowAction[] = [];
  for (const raw of table[1].split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('{')) continue;
    const field = (name: string): string | undefined => {
      const match = line.match(new RegExp(`\\b${name}:\\s*'([^']*)'`));
      return match ? match[1] : undefined;
    };
    const list = (name: string): string[] => {
      const match = line.match(new RegExp(`\\b${name}:\\s*\\[([^\\]]*)\\]`));
      if (!match) return [];
      return match[1].split(',').map((v) => v.trim().replace(/^'|'$/g, '')).filter(Boolean);
    };
    const key = field('key');
    const route = field('route');
    const permission = field('permission');
    if (!key || !route || !permission) throw new Error(`unparseable workflow row: ${line}`);
    actions.push({
      key,
      route,
      permission,
      sources: list('sources'),
      targets: list('targets'),
      requiresInput: /\brequiresInput:\s*true/.test(line),
      legacy: /\blegacy:\s*true/.test(line),
      danger: /\bdanger:\s*true/.test(line),
    });
  }
  if (actions.length === 0) throw new Error('REPAIR_ORDER_WORKFLOW_ACTIONS parsed to an empty table');
  return actions;
}

function readControllerPermissions(): Record<string, string> {
  const source = fs.readFileSync(CONTROLLER_PATH, 'utf8');
  const permissions: Record<string, string> = {};
  // The controller declares `@Post(':id/<route>')` immediately above its
  // `@Permissions(...)` guard, so read the pair in that order.
  for (const match of source.matchAll(/@Post\('([^']*)'\)\s*\n\s*@Permissions\('([^']+)'\)/g)) {
    permissions[match[1]] = match[2];
  }
  return permissions;
}

const backendActions = readBackendWorkflowActions();
/** The legacy alias stays callable on the API but is never offered to an operator. */
const offerable = backendActions.filter((action) => !action.legacy);

function form(overrides: Partial<RepairFormState> = {}): RepairFormState {
  return {
    outcome: 'REPAIRABLE',
    inspectionResult: '',
    failureDescription: '',
    repairedQuantity: '',
    scrappedQuantity: '',
    notRepairableQuantity: '',
    targetCondition: 'USED_SERVICEABLE',
    reason: '',
    notes: '',
    testResult: '',
    testNotes: '',
    repairDescription: '',
    ...overrides,
  };
}

describe('R2-G frontend action table mirrors the published backend workflow', () => {
  it('offers exactly the non-legacy backend actions', () => {
    expect(REPAIR_ACTIONS.map((a) => a.key).sort()).toEqual(offerable.map((a) => a.key).sort());
  });

  it('never offers the legacy approve-repair alias', () => {
    expect(backendActions.some((a) => a.legacy && a.key === 'approveRepair')).toBe(true);
    expect(REPAIR_ACTION_BY_KEY.approveRepair).toBeUndefined();
    expect(REPAIR_ACTIONS.map((a) => a.key)).not.toContain('approveRepair');
  });

  it('uses the exact backend route segment for every action', () => {
    for (const backend of offerable) {
      expect(REPAIR_ACTION_BY_KEY[backend.key]?.route).toBe(backend.route);
    }
  });

  it('uses the same source states the backend publishes', () => {
    for (const backend of offerable) {
      const def = REPAIR_ACTION_BY_KEY[backend.key];
      expect({ key: backend.key, sources: [...(def?.statuses ?? [])].sort() }).toEqual({
        key: backend.key,
        sources: [...backend.sources].sort(),
      });
    }
  });

  it('flags input-requiring actions exactly as the backend does', () => {
    for (const backend of offerable) {
      expect({ key: backend.key, needsInput: REPAIR_ACTION_BY_KEY[backend.key]?.needsInput }).toEqual({
        key: backend.key,
        needsInput: backend.requiresInput,
      });
    }
  });

  it('marks destructive actions exactly as the backend does', () => {
    for (const backend of offerable) {
      expect({ key: backend.key, danger: Boolean(REPAIR_ACTION_BY_KEY[backend.key]?.danger) }).toEqual({
        key: backend.key,
        danger: Boolean(backend.danger),
      });
    }
  });

  it('resolves each action to the same seeded permission key the controller enforces', () => {
    const controller = readControllerPermissions();
    for (const backend of offerable) {
      const resolved = repairActionPermissionKey(REPAIR_ACTION_BY_KEY[backend.key].permission);
      expect({ key: backend.key, permission: resolved }).toEqual({
        key: backend.key,
        permission: backend.permission,
      });
      expect({ key: backend.key, enforced: controller[`:id/${backend.route}`] }).toEqual({
        key: backend.key,
        enforced: backend.permission,
      });
    }
  });
});

describe('R2-G permission filtering never passes a shorthand verb to the exact matcher', () => {
  const seeded = ['repair-orders:read', 'repair-orders:manage', 'repair-orders:complete'];

  it('prefixes every shorthand verb with the module resource', () => {
    expect(repairActionPermissionKey('manage')).toBe('repair-orders:manage');
    expect(repairActionPermissionKey('complete')).toBe('repair-orders:complete');
    expect(repairActionPermissionKey('scrap')).toBe('repair-orders:scrap');
  });

  it('grants an action only when the seeded key is held', () => {
    const open = REPAIR_ACTION_BY_KEY.open;
    const completeServiceable = REPAIR_ACTION_BY_KEY.completeServiceable;
    const scrap = REPAIR_ACTION_BY_KEY.scrap;

    expect(canRunRepairAction(seeded, open)).toBe(true);
    expect(canRunRepairAction(['repair-orders:read'], open)).toBe(false);
    expect(canRunRepairAction(seeded, completeServiceable)).toBe(true);
    expect(canRunRepairAction(['repair-orders:manage'], completeServiceable)).toBe(false);
    expect(canRunRepairAction(['repair-orders:complete'], scrap)).toBe(false);
  });

  it('hides every action from a read-only operator and a missing permission set', () => {
    for (const action of REPAIR_ACTIONS) {
      expect(canRunRepairAction(['repair-orders:read'], action)).toBe(false);
      expect(canRunRepairAction(null, action)).toBe(false);
      expect(canRunRepairAction(undefined, action)).toBe(false);
      expect(canRunRepairAction([], action)).toBe(false);
    }
  });

  it('never grants an action through a bare verb that some other module seeds', () => {
    // `manage`, `complete` and `scrap` exist as bare verbs elsewhere in the
    // catalogue; the UI must not treat them as repair-order permissions.
    const unrelated = ['manage', 'complete', 'scrap', 'production:manage'];
    for (const action of REPAIR_ACTIONS) {
      expect(canRunRepairAction(unrelated, action)).toBe(false);
    }
  });
});

describe('R2-G offerable actions are the intersection of published and permitted', () => {
  const published = offerable.map((action) => ({
    key: action.key,
    route: action.route,
    permission: action.permission,
  }));

  it('offers every published action to an operator holding all three keys', () => {
    const granted = effectiveRepairPermissions(
      ['repair-orders:manage', 'repair-orders:complete', 'repair-orders:scrap'],
      false,
    );
    expect(offerableRepairActions(published, granted).map((a) => a.key).sort())
      .toEqual(published.map((a) => a.key).sort());
  });

  it('keeps a super administrator unfiltered, as every other admin surface does', () => {
    const granted = effectiveRepairPermissions([], true);
    expect(granted).toEqual(allRepairPermissionKeys());
    expect(offerableRepairActions(published, granted)).toHaveLength(published.length);
  });

  it('offers a super administrator nothing extra that the backend did not publish', () => {
    const granted = effectiveRepairPermissions(null, true);
    const withLegacy = [...published, { key: 'approveRepair', permission: 'repair-orders:manage' }];
    expect(offerableRepairActions(withLegacy, granted).map((a) => a.key)).not.toContain('approveRepair');
  });

  it('splits the completion actions away from a manage-only operator', () => {
    const granted = effectiveRepairPermissions(['repair-orders:manage'], false);
    const keys = offerableRepairActions(published, granted).map((a) => a.key);
    expect(keys).toContain('startRepair');
    expect(keys).toContain('cancel');
    expect(keys).not.toContain('completeServiceable');
    expect(keys).not.toContain('scrap');
  });

  it('scrap and complete permissions are independent of manage', () => {
    const completeOnly = effectiveRepairPermissions(['repair-orders:complete'], false);
    const completeKeys = offerableRepairActions(published, completeOnly).map((a) => a.key);
    expect(completeKeys).toEqual([
      'completeServiceable', 'completePartial', 'completeNotRepairable',
    ]);
    expect(completeKeys).not.toContain('scrap');
  });

  it('offers a read-only operator nothing, and unknown published keys are dropped', () => {
    const readOnly = effectiveRepairPermissions(['repair-orders:read'], false);
    expect(offerableRepairActions(published, readOnly)).toEqual([]);
    expect(offerableRepairActions([{ key: 'teleport', permission: 'repair-orders:manage' }], readOnly)).toEqual([]);
  });

  it('drops an action whose permission the user does not hold', () => {
    const granted = effectiveRepairPermissions(['repair-orders:manage'], false);
    const keys = offerableRepairActions(published, granted).map((a) => a.key);
    expect(keys).toContain('recordInspection');
    expect(keys).not.toContain('scrap');
  });
});

describe('R2-G repairable queue rows cannot be duplicated or source-invented', () => {
  it('allows a row that has neither a repair order nor a resolved return source issue', () => {
    expect(repairableRowCanCreate({ existingRepairOrder: null, exactReturnSource: { id: 'm1' } })).toBe(true);
  });

  it('refuses a row that already has a repair order', () => {
    expect(repairableRowCanCreate({
      existingRepairOrder: { id: 'ro1' },
      exactReturnSource: { id: 'm1' },
    })).toBe(false);
  });

  it('refuses a row with no exact return source, so no warehouse can be invented', () => {
    expect(repairableRowCanCreate({ existingRepairOrder: null, exactReturnSource: null })).toBe(false);
    expect(repairableRowCanCreate({})).toBe(false);
  });

  it('refuses a row that is both duplicated and source-less', () => {
    expect(repairableRowCanCreate({ existingRepairOrder: { id: 'ro1' } })).toBe(false);
  });

  it('treats a missing existing order as absent, not as a blocker', () => {
    expect(repairableRowCanCreate({ existingRepairOrder: undefined, exactReturnSource: { id: 'm1' } })).toBe(true);
  });
});

describe('R2-G buildRepairPayload produces DTO-valid request bodies', () => {
  const REMAINING = 10;

  it('sends no body for a confirmation-only action', () => {
    const result = buildRepairPayload('startRepair', form(), REMAINING);
    expect(result).toEqual({ ok: true, payload: {} });
  });

  it('attaches trimmed notes to a confirmation-only action when supplied', () => {
    expect(buildRepairPayload('startTest', form({ notes: '  resumed  ' }), REMAINING)).toEqual({
      ok: true,
      payload: { notes: 'resumed' },
    });
  });

  it('requires the inspection outcome, result and failure description', () => {
    expect(buildRepairPayload('recordInspection', form(), REMAINING)).toEqual({
      ok: false,
      fieldErrors: {
        inspectionResult: 'validation.required',
      },
    });
    expect(buildRepairPayload('recordInspection', form({ outcome: 'NOT_REPAIRABLE', inspectionResult: 'bent' }), REMAINING)).toEqual({
      ok: false,
      fieldErrors: { failureDescription: 'validation.required' },
    });
  });

  it('builds a repairable inspection result the DTO accepts', () => {
    expect(buildRepairPayload(
      'recordInspection',
      form({ inspectionResult: ' crack ', failureDescription: ' hairline ' }),
      REMAINING,
    )).toEqual({
      ok: true,
      payload: { outcome: 'REPAIRABLE', inspectionResult: 'crack', failureDescription: 'hairline' },
    });
  });

  it('requires a reason for wait-for-parts and cancel', () => {
    expect(buildRepairPayload('waitForParts', form(), REMAINING)).toEqual({
      ok: false,
      fieldErrors: { reason: 'validation.required' },
    });
    expect(buildRepairPayload('cancel', form(), REMAINING)).toEqual({
      ok: false,
      fieldErrors: { reason: 'validation.required' },
    });
    expect(buildRepairPayload('cancel', form({ reason: 'duplicate' }), REMAINING)).toEqual({
      ok: true,
      payload: { reason: 'duplicate' },
    });
  });

  it('requires a strictly positive repaired quantity for serviceable completion', () => {
    expect(buildRepairPayload('completeServiceable', form(), REMAINING)).toEqual({
      ok: false,
      fieldErrors: { repairedQuantity: 'validation.required' },
    });
    expect(buildRepairPayload('completeServiceable', form({ repairedQuantity: '0' }), REMAINING)).toEqual({
      ok: false,
      fieldErrors: { repairedQuantity: 'validation.required' },
    });
  });

  it('rejects a quantity above the remaining quantity', () => {
    expect(buildRepairPayload('completeServiceable', form({ repairedQuantity: '11' }), REMAINING)).toEqual({
      ok: false,
      fieldErrors: { repairedQuantity: 'maintenance.repairQuantityExceedsRemaining' },
    });
  });

  it('rejects a partial completion with no repaired quantity, as the DTO requires', () => {
    expect(buildRepairPayload(
      'completePartial',
      form({ repairedQuantity: '', scrappedQuantity: '2' }),
      REMAINING,
    )).toEqual({
      ok: false,
      fieldErrors: { repairedQuantity: 'validation.required' },
    });
  });

  it('bounds a partial completion by the combined quantity', () => {
    expect(buildRepairPayload(
      'completePartial',
      form({ repairedQuantity: '6', scrappedQuantity: '5' }),
      REMAINING,
    )).toEqual({
      ok: false,
      fieldErrors: {
        repairedQuantity: 'maintenance.repairQuantityExceedsRemaining',
        scrappedQuantity: 'maintenance.repairQuantityExceedsRemaining',
      },
    });
  });

  it('builds a valid partial completion', () => {
    expect(buildRepairPayload(
      'completePartial',
      form({ repairedQuantity: '6', scrappedQuantity: '4', notes: ' partial ' }),
      REMAINING,
    )).toEqual({
      ok: true,
      payload: { repairedQuantity: 6, scrappedQuantity: 4, targetCondition: 'USED_SERVICEABLE', notes: 'partial' },
    });
  });

  it('defaults a blank partial scrapped quantity to zero rather than sending null', () => {
    expect(buildRepairPayload(
      'completePartial',
      form({ repairedQuantity: '3', scrappedQuantity: '' }),
      REMAINING,
    )).toEqual({
      ok: true,
      payload: { repairedQuantity: 3, scrappedQuantity: 0, targetCondition: 'USED_SERVICEABLE' },
    });
  });

  it('rejects an out-of-enum target condition', () => {
    expect(buildRepairPayload(
      'completeServiceable',
      form({ repairedQuantity: '1', targetCondition: 'NEW' }),
      REMAINING,
    )).toEqual({
      ok: false,
      fieldErrors: { targetCondition: 'maintenance.repairTargetConditionInvalid' },
    });
  });

  it('requires quantity and reason for a not-repairable completion', () => {
    expect(buildRepairPayload('completeNotRepairable', form(), REMAINING)).toEqual({
      ok: false,
      fieldErrors: { notRepairableQuantity: 'validation.required' },
    });
    expect(buildRepairPayload(
      'completeNotRepairable',
      form({ notRepairableQuantity: '2' }),
      REMAINING,
    )).toEqual({
      ok: false,
      fieldErrors: { reason: 'validation.required' },
    });
    expect(buildRepairPayload(
      'completeNotRepairable',
      form({ notRepairableQuantity: '2', reason: 'beyond economic repair' }),
      REMAINING,
    )).toEqual({
      ok: true,
      payload: { notRepairableQuantity: 2, reason: 'beyond economic repair' },
    });
  });

  it('treats the scrap reason as optional, as its DTO does', () => {
    expect(buildRepairPayload('scrap', form({ scrappedQuantity: '1' }), REMAINING)).toEqual({
      ok: true,
      payload: { scrappedQuantity: 1 },
    });
  });

  it('sends only keys the target DTO declares', () => {
    const allowed: Record<string, string[]> = {
      recordInspection: ['outcome', 'inspectionResult', 'failureDescription', 'notes'],
      waitForParts: ['reason', 'notes'],
      cancel: ['reason', 'notes'],
      completeServiceable: ['repairedQuantity', 'targetCondition', 'repairDescription', 'testResult', 'testNotes', 'notes'],
      completePartial: ['repairedQuantity', 'scrappedQuantity', 'targetCondition', 'notes'],
      completeNotRepairable: ['notRepairableQuantity', 'reason', 'notes'],
      scrap: ['scrappedQuantity', 'reason', 'notes'],
    };
    const samples: Record<string, RepairFormState> = {
      recordInspection: form({ inspectionResult: 'ok', failureDescription: 'why', notes: 'n' }),
      waitForParts: form({ reason: 'parts', notes: 'n' }),
      cancel: form({ reason: 'cancel', notes: 'n' }),
      completeServiceable: form({
        repairedQuantity: '2', repairDescription: 'fixed', testResult: 'pass', testNotes: 'tn', notes: 'n',
      }),
      completePartial: form({ repairedQuantity: '2', scrappedQuantity: '1', notes: 'n' }),
      completeNotRepairable: form({ notRepairableQuantity: '2', reason: 'r', notes: 'n' }),
      scrap: form({ scrappedQuantity: '2', reason: 'r', notes: 'n' }),
    };
    for (const [key, keys] of Object.entries(allowed)) {
      const result = buildRepairPayload(key, samples[key], REMAINING);
      expect({ key, ok: result.ok }).toEqual({ key, ok: true });
      if (!result.ok) continue;
      const sent = Object.keys(result.payload).sort();
      expect({ key, sent, unexpected: sent.filter((k) => !keys.includes(k)) }).toEqual({
        key, sent, unexpected: [],
      });
    }
  });

  it('keeps every form kind free of an action it does not belong to', () => {
    expect(repairActionDef('completePartial')?.formKind).toBe('partial');
    expect(repairActionDef('completePartial')?.needsInput).toBe(true);
    expect(repairActionDef('startTest')?.formKind).toBe('none');
    expect(repairActionDef('startTest')?.needsInput).toBe(false);
  });
});
