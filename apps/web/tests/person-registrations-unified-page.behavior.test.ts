/**
 * R4R Group 1 unified workspace — BEHAVIORAL proof.
 *
 * This is NOT a source-string test. It transpiles the real page component
 * (`src/app/admin/core/persons/page.tsx`), runs it through the same lightweight
 * React harness used by `overhead-allocation-requests.test.ts`, captures the real
 * `useCrudList` options the page hands over, and then invokes the page's own
 * `listRequest` / `detailRequest` / `createRequest` / `updateRequest` /
 * `mapFormToPayload` / `mapRecordToForm` / `validate` callbacks and inspects the
 * rendered tree.
 *
 * A page that stopped calling the canonical `/person-registrations` POST/PATCH,
 * that bypassed it with a legacy create, or that dropped the permission-gated
 * optional sections would fail these tests, because the assertions bind to the
 * executed callbacks and rendered output, not to the file text.
 *
 * `r4r-group1-unified-workspace.test.ts` is a complementary STATIC source guard;
 * this suite is the executable contract.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const PAGE = path.join(__dirname, '../src/app/admin/core/persons/page.tsx');
const source = fs.readFileSync(PAGE, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;

let capturedOptions: any = null;
let capturedActions: any[] = [];

interface HarnessOverrides {
  permissions?: string[];
  isSuperAdmin?: boolean;
  modalOpen?: boolean;
  form?: any;
  data?: any[];
}

interface Harness {
  api: { get: jest.Mock; post: jest.Mock; patch: jest.Mock; delete: jest.Mock };
  toast: jest.Mock;
  error: jest.Mock;
  exported: any;
  options: () => any;
  actions: () => any[];
  render: (component: any, props?: any) => any;
}

function harness(overrides: HarnessOverrides = {}): Harness {
  const slots: any[] = [];
  let cursor = 0;
  const effects: (() => void)[] = [];
  const error = jest.fn();
  const toast = jest.fn();
  const api = {
    get: jest.fn().mockResolvedValue({ data: [], meta: {} }),
    post: jest.fn().mockResolvedValue({}),
    patch: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  };
  capturedOptions = null;
  capturedActions = [];
  const auth = {
    loading: false,
    isSuperAdmin: overrides.isSuperAdmin ?? false,
    permissions: { permissions: overrides.permissions ?? [] },
  };
  const React = {
    createElement: (type: any, props: any, ...children: any[]) => ({ type, props: { ...props, children } }),
    Fragment: 'Fragment',
    useState: (initial: any) => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (value: any) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef: (initial: any) => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useCallback: (fn: any) => fn,
    useMemo: (fn: any) => fn(),
    useEffect: (run: () => any, deps: any[]) => {
      const i = cursor++;
      if (!slots[i] || deps.some((dep: any, n: number) => dep !== slots[i].deps[n])) {
        slots[i] = { deps };
        effects.push(() => { slots[i].cleanup = run(); });
      }
    },
  };
  const useCrudList = (options: any) => {
    capturedOptions = options;
    return {
      data: overrides.data ?? [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      loading: false,
      error: '',
      form: overrides.form ?? options.initialForm,
      setForm: jest.fn(),
      modalOpen: overrides.modalOpen ?? false,
      editItem: null,
      detailLoading: false,
      saving: false,
      refresh: jest.fn(),
      openCreate: jest.fn(),
      openEdit: jest.fn(),
      closeFormModal: jest.fn(),
      handleSave: jest.fn(),
    };
  };
  const exported: any = {};
  vm.runInNewContext(compiled, {
    exports: exported,
    AbortController,
    crypto: { randomUUID: () => 'request-id' },
    require: (name: string) => {
      if (name === 'react') return React;
      if (name.endsWith('/lib/api')) return { api };
      if (name.endsWith('/lib/form-utils')) return require('../src/lib/form-utils');
      if (name.endsWith('/useCrudList')) return { useCrudList };
      if (name.endsWith('/use-translation')) return { useTranslation: () => ({ t: (key: string) => key, dir: 'ltr', locale: 'en' }) };
      if (name.endsWith('/toast-provider')) return { useToast: () => ({ showToast: toast }) };
      if (name.endsWith('/auth-context')) return { useAuth: () => auth };
      if (name.endsWith('/error-handler')) return { useApiErrorHandler: () => error };
      if (name.endsWith('/form-validation')) return { adaptFieldErrorsToMap: (x: unknown) => x, focusFirstInvalidField: () => {} };
      if (name.endsWith('/admin-action-bar')) {
        return {
          useRegisterAdminActions: (actions: any[]) => { capturedActions = actions; },
          useStableHandlers: (handlers: Record<string, () => void>) => ({ exec: (key: string) => handlers[key]?.() }),
          ActionAddIcon: 'ActionAddIcon',
          ActionEditIcon: 'ActionEditIcon',
          ActionRefreshIcon: 'ActionRefreshIcon',
        };
      }
      // React-free modules (f9 adapters, entity layout, ui/grid components) are only
      // referenced as element types or values; a permissive proxy is sufficient.
      return new Proxy({}, { get: (_target, key) => String(key) });
    },
  });
  return {
    api,
    toast,
    error,
    exported,
    options: () => capturedOptions,
    actions: () => capturedActions,
    render: (component: any, props?: any) => {
      const tree = component(props);
      effects.splice(0).forEach((run) => run());
      return tree;
    },
  };
}

function elements(tree: any): any[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...elements(tree.props?.children)];
}

const checkboxDisabled = (tree: any): boolean[] =>
  elements(tree)
    .filter((n) => n.type === 'input' && n.props?.type === 'checkbox')
    .map((n) => Boolean(n.props.disabled));

const emptyForm = {
  code: '', name: '', category: 'MAINTENANCE', phone: '', email: '', notes: '', isActive: true,
  branchId: '', administrationId: '', departmentId: '', jobTitleId: '',
  assignmentType: 'PRIMARY', effectiveFrom: '', assignmentNotes: '',
  enableMaintenance: false, maintenanceRole: '', maintenanceSpecialty: '', dailyCapacityMinutes: 480, maintenanceIsActive: true,
  enableLogin: false, loginEmail: '', loginPassword: '', loginName: '', loginPhone: '', roleIds: [],
};

describe('Group 1 unified page — executed canonical API wiring', () => {
  it('listRequest calls GET /person-registrations with pagination params', async () => {
    const h = harness();
    h.render(h.exported.default);
    await h.options().listRequest(2);
    expect(h.api.get).toHaveBeenCalledWith('/person-registrations', { params: { page: 2, limit: 10 } });
  });

  it('detailRequest reads GET /person-registrations/:id', async () => {
    const h = harness();
    h.render(h.exported.default);
    await h.options().detailRequest('cm1abc');
    expect(h.api.get).toHaveBeenCalledWith('/person-registrations/cm1abc');
  });

  it('createRequest issues canonical POST /person-registrations with the mapped payload', async () => {
    const h = harness();
    h.render(h.exported.default);
    const payload = { name: 'Ali', category: 'MAINTENANCE' };
    await h.options().createRequest(payload);
    expect(h.api.post).toHaveBeenCalledTimes(1);
    expect(h.api.post).toHaveBeenCalledWith('/person-registrations', payload);
  });

  it('updateRequest issues canonical PATCH /person-registrations/:id', async () => {
    const h = harness();
    h.render(h.exported.default);
    await h.options().updateRequest('rec1', { name: 'edited' });
    expect(h.api.patch).toHaveBeenCalledWith('/person-registrations/rec1', { name: 'edited' });
  });

  it('no executed write ever targets /employees, /users or /maintenance/personnel', async () => {
    const h = harness();
    h.render(h.exported.default);
    await h.options().createRequest({ name: 'A' });
    await h.options().updateRequest('rec1', { name: 'A' });
    await h.options().listRequest(1);
    await h.options().detailRequest('rec1');
    const urls = [...h.api.get.mock.calls, ...h.api.post.mock.calls, ...h.api.patch.mock.calls].map((c) => String(c[0]));
    const legacy = urls.filter((url) => /(^|\/)(employees|users|maintenance\/personnel)(\/|$)/.test(url));
    expect(legacy).toEqual([]);
  });
});

describe('Group 1 unified page — executed payload and validation logic', () => {
  it('mapFormToPayload emits placement and omits optional blocks when toggles are off', () => {
    const h = harness();
    h.render(h.exported.default);
    const payload = h.options().mapFormToPayload({
      ...emptyForm, name: 'Ali', departmentId: 'dep1', branchId: 'br1',
      administrationId: 'adm1', jobTitleId: 'job1', assignmentType: 'PRIMARY', effectiveFrom: '2026-01-01',
    });
    expect(payload).toMatchObject({
      name: 'Ali',
      category: 'MAINTENANCE',
      placement: expect.objectContaining({ departmentId: 'dep1', branchId: 'br1', administrationId: 'adm1', jobTitleId: 'job1' }),
    });
    expect(payload).not.toHaveProperty('login');
    expect(payload).not.toHaveProperty('maintenance');
  });

  it('mapFormToPayload sends a login block only when enableLogin is true, and never auth internals', () => {
    const h = harness();
    h.render(h.exported.default);
    expect(h.options().mapFormToPayload({ ...emptyForm, name: 'A', departmentId: 'd' })).not.toHaveProperty('login');

    const on = h.options().mapFormToPayload({
      ...emptyForm, name: 'A', departmentId: 'd', enableLogin: true,
      loginEmail: 'a@b.com', loginPassword: 'S3cret!', loginName: 'A', loginPhone: '123', roleIds: ['r1'],
    });
    expect(on.login).toEqual({ email: 'a@b.com', password: 'S3cret!', name: 'A', phone: '123', roleIds: ['r1'] });
    const serialized = JSON.stringify(on);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('authVersion');
    expect(serialized).not.toContain('lastLoginAt');
  });

  it('mapFormToPayload sends a maintenance block only when enableMaintenance is true', () => {
    const h = harness();
    h.render(h.exported.default);
    expect(h.options().mapFormToPayload({ ...emptyForm, name: 'A', departmentId: 'd' })).not.toHaveProperty('maintenance');

    const on = h.options().mapFormToPayload({
      ...emptyForm, name: 'A', departmentId: 'd', enableMaintenance: true,
      maintenanceRole: 'TECH', maintenanceSpecialty: 'Mech', dailyCapacityMinutes: 300, maintenanceIsActive: true,
    });
    expect(on.maintenance).toEqual({ role: 'TECH', specialty: 'Mech', dailyCapacityMinutes: 300, isActive: true });
  });

  it('validate rejects a missing name, missing department, and toggle-required fields', () => {
    const h = harness();
    h.render(h.exported.default);
    expect(h.options().validate({ ...emptyForm })).toEqual({ fieldErrors: { name: 'validation.requiredField', departmentId: 'validation.requiredField' } });
    expect(h.options().validate({ ...emptyForm, name: 'A', departmentId: 'd', enableLogin: true })).toEqual({ fieldErrors: { loginEmail: 'validation.requiredField' } });
    expect(h.options().validate({ ...emptyForm, name: 'A', departmentId: 'd', enableMaintenance: true })).toEqual({ fieldErrors: { maintenanceRole: 'validation.requiredField' } });
    expect(h.options().validate({ ...emptyForm, name: 'A', departmentId: 'd' })).toBeNull();
  });

  it('mapRecordToForm hydrates capabilities from the real API shape (login/maintenanceCapability) but never prefills role grants', () => {
    const h = harness();
    h.render(h.exported.default);
    const form = h.options().mapRecordToForm({
      id: 'p1', code: 'EMP-1', name: 'Ali', category: 'MAINTENANCE', phone: '1', email: 'a@b.com', isActive: true,
      assignments: [{ department: { id: 'd1' }, jobTitle: { id: 'j1' }, assignmentType: 'PRIMARY' }],
      login: { id: 'u1', email: 'a@b.com', status: 'ACTIVE', roleIds: ['r-should-be-ignored'] },
      maintenanceCapability: { id: 'm1', role: 'TECH', specialty: 'M', isActive: true, dailyCapacityMinutes: 480 },
    });
    expect(form.enableLogin).toBe(true);
    expect(form.enableMaintenance).toBe(true);
    expect(form.loginEmail).toBe('a@b.com');
    expect(form.loginPassword).toBe('');
    expect(form.roleIds).toEqual([]);
    expect(form.departmentId).toBe('d1');
  });

  it('mapRecordToForm ignores the legacy user/maintenancePersonnel keys', () => {
    const h = harness();
    h.render(h.exported.default);
    const form = h.options().mapRecordToForm({
      id: 'p1', name: 'Ali', category: 'MAINTENANCE', isActive: true,
      assignments: [{ department: { id: 'd1' }, assignmentType: 'PRIMARY' }],
      user: { email: 'a@b.com', status: 'ACTIVE' },
      maintenancePersonnel: { role: 'TECH', isActive: true },
    });
    expect(form.enableLogin).toBe(false);
    expect(form.enableMaintenance).toBe(false);
  });
});

describe('Group 1 unified page — independent permission gating (rendered)', () => {
  it('registration action enablement follows operational-person grants', () => {
    const allowed = harness({ permissions: ['operational-person:create', 'operational-person:update'] });
    allowed.render(allowed.exported.default);
    const allowedById = Object.fromEntries(allowed.actions().map((a) => [a.id, a]));
    expect(allowedById.new.enabled).toBe(true);

    const denied = harness({ permissions: [] });
    denied.render(denied.exported.default);
    const deniedById = Object.fromEntries(denied.actions().map((a) => [a.id, a]));
    expect(deniedById.new.enabled).toBe(false);
  });

  it('without user:* and maintenance-personnel:* the optional toggles are disabled', () => {
    const h = harness({ permissions: ['operational-person:create'], modalOpen: true, form: { ...emptyForm } });
    const tree = h.render(h.exported.default);
    const disabled = checkboxDisabled(tree);
    expect(disabled.length).toBeGreaterThanOrEqual(2);
    expect(disabled.every(Boolean)).toBe(true);
  });

  it('with user:* and maintenance-personnel:* the optional toggles are enabled', () => {
    const h = harness({ permissions: ['user:create', 'maintenance-personnel:create'], modalOpen: true, form: { ...emptyForm } });
    const tree = h.render(h.exported.default);
    const disabled = checkboxDisabled(tree);
    expect(disabled.length).toBeGreaterThanOrEqual(2);
    expect(disabled.some(Boolean)).toBe(false);
  });

  it('roles section renders only when the caller may update users', () => {
    const without = harness({ permissions: ['operational-person:create'], modalOpen: true, form: { ...emptyForm, enableLogin: true } });
    expect(elements(without.render(without.exported.default)).some((n) => n.props?.['data-section'] === 'roles-access')).toBe(false);

    const withUser = harness({ permissions: ['operational-person:create', 'user:update'], modalOpen: true, form: { ...emptyForm, enableLogin: true } });
    expect(elements(withUser.render(withUser.exported.default)).some((n) => n.props?.['data-section'] === 'roles-access')).toBe(true);
  });

  it('SUPER_ADMIN bypass enables every gated control', () => {
    const h = harness({ isSuperAdmin: true, modalOpen: true, form: { ...emptyForm, enableLogin: true } });
    const tree = h.render(h.exported.default);
    expect(elements(tree).some((n) => n.props?.['data-section'] === 'roles-access')).toBe(true);
    expect(checkboxDisabled(tree).some(Boolean)).toBe(false);
  });
});