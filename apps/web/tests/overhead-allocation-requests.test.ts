import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { api as realApi } from '../src/lib/api';

const ROOT = '/production/overhead-allocations';
const source = fs.readFileSync(path.join(__dirname, '../src/app/admin/production/cost/overhead-allocations/page.tsx'), 'utf8');
const compiled = ts.transpileModule(source + '\nexport { useRead, Workspace, CreateDraft, AllocationDetails };', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
const tick = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Runs the actual page callbacks with deterministic hook scheduling. Browser proof
// remains a separate gate; no duplicate request implementation is tested here.
function harness() {
  const slots: any[] = [];
  let cursor = 0;
  const effects: (() => void)[] = [];
  const error = jest.fn(), toast = jest.fn();
  const api = { get: jest.fn().mockResolvedValue({ data: [], meta: {} }), post: jest.fn(), patch: jest.fn().mockResolvedValue({}) };
  const auth = { loading: false, contextLoading: false, isSuperAdmin: false, permissions: { permissions: [] as string[] }, contextReady: true, activeContext: { companyId: 'a', branchId: 'a1' }, contextVersion: 1 };
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
    useEffect: (run: () => any, deps: any[]) => {
      const i = cursor++;
      if (!slots[i] || deps.some((dep, n) => dep !== slots[i].deps[n])) {
        const previous = slots[i];
        slots[i] = { deps, cleanup: previous?.cleanup };
        effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = run(); });
      }
    },
  };
  const exports: any = {};
  vm.runInNewContext(compiled, { exports, AbortController, crypto: { randomUUID: () => 'request-id' }, require: (name: string) => {
    if (name === 'react') return React;
    if (name.endsWith('/lib/api')) return { api };
    if (name.endsWith('/auth-context')) return { useAuth: () => auth };
    if (name.endsWith('/use-translation')) return { useTranslation: () => ({ t: (key: string) => key, dir: 'ltr', locale: 'en' }) };
    if (name.endsWith('/error-handler')) return { useApiErrorHandler: () => error };
    if (name.endsWith('/toast-provider')) return { useToast: () => ({ showToast: toast }) };
    if (name.endsWith('/overhead-allocation')) return require('../src/lib/overhead-allocation');
    return new Proxy({}, { get: (_target, key) => String(key) });
  } });
  return {
    api, error, toast, auth, exports,
    render: (component: any, props: any = {}) => { cursor = 0; const tree = component(props); effects.splice(0).forEach(run => run()); return tree; },
    unmount: () => slots.forEach(slot => slot?.cleanup?.()),
  };
}
function elements(tree: any): any[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...elements(tree.props?.children)];
}
const button = (tree: any, label: string) => elements(tree).find(node => node.type === 'Button' && node.props.children.includes(label));
const row = { id: 'id%2Fkept', notes: 'original', status: 'DRAFT', period: { code: 'P' }, periodFrom: '2026-09-01', periodTo: '2026-09-02', currencyCode: 'USD' };
async function details(can: (action: string) => boolean = () => true) {
  const h = harness();
  h.api.get.mockResolvedValue(row);
  const render = () => h.render(h.exports.AllocationDetails, { id: row.id, can, onClose: jest.fn() });
  render(); await tick(); render();
  return { ...h, render };
}

describe('B2 page actual request callbacks and async contract', () => {
  it('preserves list URL, query order, encoding, pagination and refresh', async () => {
    const h = harness(), render = () => h.render(h.exports.Workspace, { can: () => true });
    let tree = render(); await tick();
    expect(h.api.get.mock.calls[0][0]).toBe(`${ROOT}?page=1&limit=20&search=`);
    elements(tree).find(node => node.type === 'Input').props.onChange({ target: { value: 'a & عربي/%' } });
    render(); await tick();
    expect(h.api.get.mock.calls[h.api.get.mock.calls.length - 1][0]).toBe(`${ROOT}?page=1&limit=20&search=${encodeURIComponent('a & عربي/%')}`);
    tree = render();
    elements(tree).find(node => node.type === 'AdminDataGrid').props.onRefresh();
    render(); await tick();
    expect(h.api.get).toHaveBeenCalledTimes(3);
    expect(h.api.get.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('preserves eligible-period query and AbortSignal', async () => {
    const h = harness(); h.render(h.exports.CreateDraft, { onClose: jest.fn(), onCreated: jest.fn() });
    expect(h.api.get.mock.calls[0][0]).toBe(`${ROOT}/eligible-periods?page=1&limit=20&search=`);
    expect(h.api.get.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    h.unmount(); expect(h.api.get.mock.calls[0][1].signal.aborted).toBe(true); await tick();
  });

  it.each(['lines', 'sources', 'history'])('preserves exact %s read URL and existing ID encoding', async tab => {
    const h = harness(); h.api.get.mockResolvedValue({ ...row, status: 'FINAL' });
    const render = () => h.render(h.exports.AllocationDetails, { id: row.id, can: () => true, onClose: jest.fn() });
    render(); await tick(); let tree = render(); await tick();
    expect(h.api.get.mock.calls[0][0]).toBe(`${ROOT}/${row.id}`);
    button(tree, `overheadAllocation.${tab}`).props.onClick(); tree = render(); await tick();
    expect(h.api.get.mock.calls[h.api.get.mock.calls.length - 1][0]).toBe(`${ROOT}/${row.id}/${tab}?page=1&limit=20`);
  });

  it('SAVE preserves payload, one request, lock, success toast and read refresh', async () => {
    const h = await details(), pending = deferred<any>(); h.api.patch.mockReturnValue(pending.promise);
    let tree = h.render();
    elements(tree).find(node => node.type === 'Textarea').props.onChange({ target: { value: 'updated عربي' } });
    tree = h.render(); const save = button(tree, 'common.save');
    save.props.onClick(); save.props.onClick();
    expect(h.api.patch).toHaveBeenCalledTimes(1);
    expect(h.api.patch).toHaveBeenCalledWith(`${ROOT}/${row.id}`, { notes: 'updated عربي' });
    expect(button(h.render(), 'common.save').props.disabled).toBe(true);
    pending.resolve({}); await tick(); h.render(); await tick();
    expect(h.toast).toHaveBeenCalledWith('overheadAllocation.saved', 'success');
    expect(h.api.get.mock.calls.filter(call => call[0] === `${ROOT}/${row.id}`)).toHaveLength(2);
  });

  it('FINALIZE preserves empty-object payload, endpoint and double-submit lock', async () => {
    const h = await details(); h.api.post.mockResolvedValue({ data: [], meta: {}, sourceAmount: '1' });
    button(h.render(), 'overheadAllocation.calculate').props.onClick(); await tick();
    let tree = h.render(); button(tree, 'overheadAllocation.finalize').props.onClick(); tree = h.render();
    const modal = elements(tree).find(node => node.type === 'Modal' && node.props.title === 'overheadAllocation.confirm');
    expect(modal.props.open).toBe(true);
    const confirm = button(modal, 'overheadAllocation.finalize'), pending = deferred<any>(); h.api.patch.mockReturnValue(pending.promise);
    confirm.props.onClick(); confirm.props.onClick();
    expect(h.api.patch).toHaveBeenCalledTimes(1);
    expect(h.api.patch).toHaveBeenCalledWith(`${ROOT}/${row.id}/finalize`, {});
    pending.resolve({}); await tick(); tree = h.render();
    expect(h.toast).toHaveBeenCalledWith('overheadAllocation.finalized', 'success');
    expect(elements(tree).find(node => node.type === 'Modal' && node.props.title === 'overheadAllocation.confirm').props.open).toBe(false);
  });

  it('POST TO LEDGER preserves empty-object payload, endpoint and double-submit lock', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ allocationId: row.id, status: 'POSTED', currencyCode: 'USD', counts: { lineCount: 1, postedCount: 1, alreadyPostedCount: 0, zeroLineCount: 0 }, lines: [] }) });
    const h = harness(); h.api.get.mockResolvedValue({ ...row, status: 'FINAL' });
    const render = () => h.render(h.exports.AllocationDetails, { id: row.id, can: () => true, onClose: jest.fn() });
    let tree = render(); await tick(); tree = render();
    expect(button(tree, 'overheadAllocation.postToLedger')).toBeDefined();
    button(tree, 'overheadAllocation.postToLedger').props.onClick(); tree = render();
    const modal = elements(tree).find(node => node.type === 'Modal' && node.props.title === 'overheadAllocation.postToLedger');
    expect(modal.props.open).toBe(true);
    const post = button(modal, 'overheadAllocation.postToLedger');
    post.props.onClick(); post.props.onClick();
    const fetchMock = global.fetch as jest.Mock;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe(`/api/v1${ROOT}/${row.id}/post-to-ledger`);
    expect(options.method).toBe('POST'); expect(options.body).toBe(JSON.stringify({}));
    await tick(); tree = render();
    expect(h.toast).toHaveBeenCalledWith('overheadAllocation.ledgerPosted', 'success');
    expect(h.api.get.mock.calls.filter(call => call[0] === `${ROOT}/${row.id}`)).toHaveLength(2);
  });

  it('ledger tab is present with permission and reads the R1C report once authorized FINAL', async () => {
    const h = harness();
    h.api.get.mockImplementation((url: string) => url.endsWith('/reconciliation')
      ? Promise.resolve({ meta: { allocationId: row.id, allocationStatus: 'FINAL', currencyCode: 'USD', readOnly: true }, aggregate: { sourceTotal: '100', poolTotal: '100', postedEligibleTotal: '100', zeroTotal: '0', activePostedTotal: '100', sourcePoolConserved: true, poolFullyValued: true }, counts: { eligibleLineCount: 1, zeroLineCount: 0, postedLineCount: 1, missingLineCount: 0, ledgerPrimaryCount: 1, ledgerReversalCount: 0, lineDefectCount: 0 }, lines: [], decision: { status: 'ALL_CLEAN', totalDefectCount: 0, lineDefectCount: 0, reconciled: true, note: 'clear' } })
      : Promise.resolve({ ...row, status: 'FINAL' }));
    const render = () => h.render(h.exports.AllocationDetails, { id: row.id, can: (action: string) => action === 'reconcile', onClose: jest.fn() });
    let tree = render(); await tick(); tree = render();
    expect(button(tree, 'overheadAllocation.ledger')).toBeDefined();
    button(tree, 'overheadAllocation.ledger').props.onClick(); tree = render(); await tick(); tree = render();
    expect(h.api.get.mock.calls.map(call => call[0])).toEqual([`${ROOT}/${row.id}`, `${ROOT}/${row.id}/lines?page=1&limit=20`, `${ROOT}/${row.id}/reconciliation`]);
    expect(h.api.get.mock.calls[2][1].signal).toBeInstanceOf(AbortSignal);
    const summary = elements(tree).filter(node => node.type === 'p').some(node => JSON.stringify(node.props.children).includes('overheadAllocation.reconTitle'));
    expect(summary).toBe(true);
  });

  it('denied or non-final rows never expose the ledger tab or post button', async () => {
    const h = harness(); h.api.get.mockResolvedValue({ ...row, status: 'FINAL' });
    const render = () => h.render(h.exports.AllocationDetails, { id: row.id, can: () => false, onClose: jest.fn() });
    let tree = render(); await tick(); tree = render();
    expect(button(tree, 'overheadAllocation.ledger')).toBeUndefined();
    expect(button(tree, 'overheadAllocation.postToLedger')).toBeUndefined();
    expect(h.api.get.mock.calls.map(call => call[0])).toEqual([`${ROOT}/${row.id}`, `${ROOT}/${row.id}/lines?page=1&limit=20`]);
    const d = await details(); expect(button(d.render(), 'overheadAllocation.ledger')).toBeUndefined();
  });

  it('failure keeps lock released and never emits a success toast', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('localized API error'));
    const h = harness(); h.api.get.mockResolvedValue({ ...row, status: 'FINAL' });
    const render = () => h.render(h.exports.AllocationDetails, { id: row.id, can: () => true, onClose: jest.fn() });
    let tree = render(); await tick(); tree = render();
    button(tree, 'overheadAllocation.postToLedger').props.onClick(); tree = render();
    const modal = elements(tree).find(node => node.type === 'Modal' && node.props.title === 'overheadAllocation.postToLedger');
    expect(modal).toBeDefined();
    button(modal, 'overheadAllocation.postToLedger').props.onClick();
    await tick(); tree = render();
    expect(h.error).toHaveBeenCalledTimes(1); expect(h.toast).not.toHaveBeenCalled();
    expect(elements(tree).find(node => node.type === 'Modal' && node.props.title === 'overheadAllocation.postToLedger')).toBeUndefined();
    expect(button(tree, 'overheadAllocation.postToLedger').props.disabled).toBe(false);
  });

  it('failure keeps entered notes, delegates error, releases lock and never emits success', async () => {
    const h = await details(), failure = new Error('localized API error'); h.api.patch.mockRejectedValue(failure);
    let tree = h.render(); elements(tree).find(node => node.type === 'Textarea').props.onChange({ target: { value: 'keep me' } });
    button(h.render(), 'common.save').props.onClick(); await tick(); tree = h.render();
    expect(h.error).toHaveBeenCalledWith(failure); expect(h.toast).not.toHaveBeenCalled();
    expect(elements(tree).find(node => node.type === 'Textarea').props.value).toBe('keep me');
    expect(button(tree, 'common.save').props.disabled).toBe(false);
    expect(h.api.get).toHaveBeenCalledTimes(1);
  });

  it('permission-denied page makes no request and update action remains hidden', async () => {
    const h = harness(), tree = h.render(h.exports.default);
    expect(tree.props.role).toBe('alert'); expect(tree.props.children).toContain('errors.forbidden');
    expect(h.api.get).not.toHaveBeenCalled();
    const d = await details(() => false); expect(button(d.render(), 'common.save')).toBeUndefined();
  });

  it('context-missing allowed user makes no request', () => {
    const h = harness(); h.auth.permissions.permissions = ['production-cost-overhead-allocation:read']; h.auth.contextReady = false;
    expect(h.render(h.exports.default).props.children).toContain('overheadAllocation.contextRequired');
    expect(h.api.get).not.toHaveBeenCalled();
  });

  it('path switch and unmount abort requests and suppress stale success/error/loading writes', async () => {
    const h = harness(), first = deferred<any>(), second = deferred<any>();
    const a = jest.fn().mockReturnValue(first.promise), b = jest.fn().mockReturnValue(second.promise);
    const read = (key: string | null, fetcher: any) => h.render(() => h.exports.useRead(key, fetcher, 0));
    read('a', a); read('b', b);
    expect(a.mock.calls[0][0].aborted).toBe(true);
    first.resolve({ stale: true }); await tick();
    expect(read('b', b)).toMatchObject({ data: null, loading: true, failed: false });
    second.resolve({ current: true }); await tick();
    expect(read('b', b).data).toEqual({ current: true });
    const third = deferred<any>(), c = jest.fn().mockReturnValue(third.promise); read('c', c); h.unmount();
    third.reject(new Error('aborted')); await tick(); expect(h.error).not.toHaveBeenCalled();
    expect(c.mock.calls[0][0].aborted).toBe(true);
  });

  it('same-key rerender does not refetch; null disables; revision refresh uses latest callback', async () => {
    const h = harness(), first = jest.fn().mockResolvedValue(1), latest = jest.fn().mockResolvedValue(2);
    const read = (key: string | null, fetcher: any, revision: number) => h.render(() => h.exports.useRead(key, fetcher, revision));
    read(null, first, 0); expect(first).not.toHaveBeenCalled();
    read('a', first, 0); await tick(); read('a', latest, 0); expect(latest).not.toHaveBeenCalled();
    read('a', latest, 1); await tick(); expect(latest).toHaveBeenCalledTimes(1); expect(read('a', latest, 1).data).toBe(2);
  });
});

describe('B2 optional status query owner contract', () => {
  it.each([
    ['', ''], ['DRAFT', ''], ['FINAL', ''],
    ['', 'a & عربي/%'], ['DRAFT', 'a & عربي/%'], ['FINAL', 'a & عربي/%'],
  ])('emits only explicit status %s while preserving search %s', async (status, search) => {
    const h = harness(), render = () => h.render(h.exports.Workspace, { can: () => true });
    const tree = render(); await tick();
    elements(tree).find(node => node.type === 'Input').props.onChange({ target: { value: search } });
    elements(tree).find(node => node.type === 'Select').props.onChange({ target: { value: status } });
    render(); await tick();
    const url = h.api.get.mock.calls[h.api.get.mock.calls.length - 1][0];
    expect(url).toBe(`${ROOT}?page=1&limit=20&search=${encodeURIComponent(search)}${status ? '&status=' + status : ''}`);
    const params = new URL(url, 'http://localhost').searchParams;
    expect(params.getAll('status')).toEqual(status ? [status] : []);
    expect(params.get('page')).toBe('1'); expect(params.get('limit')).toBe('20'); expect(params.get('search')).toBe(search);
    expect(url).not.toMatch(/status=(?:&|$|undefined|null)/);
  });

  it.each(['DRAFT', 'FINAL'])('switches %s to ALL with no status parameter and resets page', async status => {
    const h = harness(), render = () => h.render(h.exports.Workspace, { can: () => true });
    let tree = render(); await tick();
    elements(tree).find(node => node.type === 'Select').props.onChange({ target: { value: status } });
    render(); await tick(); tree = render();
    elements(tree).find(node => node.type === 'Pagination').props.onPageChange(3); render(); await tick(); tree = render();
    expect(h.api.get.mock.calls[h.api.get.mock.calls.length - 1][0]).toContain('page=3');
    elements(tree).find(node => node.type === 'Select').props.onChange({ target: { value: '' } });
    render(); await tick();
    expect(h.api.get.mock.calls[h.api.get.mock.calls.length - 1][0]).toBe(`${ROOT}?page=1&limit=20&search=`);
  });

  it('rapid DRAFT/FINAL/ALL changes abort old reads and discard their late responses', async () => {
    const h = harness(), pending = [deferred<any>(), deferred<any>(), deferred<any>(), deferred<any>()];
    pending.forEach(item => h.api.get.mockImplementationOnce(() => item.promise));
    const render = () => h.render(h.exports.Workspace, { can: () => true });
    let tree = render();
    for (const status of ['DRAFT', 'FINAL', '']) {
      elements(tree).find(node => node.type === 'Select').props.onChange({ target: { value: status } }); tree = render();
    }
    expect(h.api.get).toHaveBeenCalledTimes(4);
    for (const call of h.api.get.mock.calls.slice(0, 3)) expect(call[1].signal.aborted).toBe(true);
    pending[3].resolve({ data: [{ id: 'current' }], meta: {} }); await tick();
    for (const item of pending.slice(0, 3)) item.resolve({ data: [{ id: 'stale' }], meta: {} });
    await tick(); tree = render();
    expect(elements(tree).find(node => node.type === 'AdminDataGrid').props.data).toEqual([{ id: 'current' }]);
    expect(h.api.get.mock.calls[3][0]).toBe(`${ROOT}?page=1&limit=20&search=`);
  });

  it('never emits a placeholder or an unexpected UI status as a query value', async () => {
    const h = harness(), render = () => h.render(h.exports.Workspace, { can: () => true });
    let tree = render(); await tick();
    for (const status of ['ALL', 'INVALID', 'undefined', 'null']) {
      elements(tree).find(node => node.type === 'Select').props.onChange({ target: { value: status } }); tree = render(); await tick();
      expect(new URL(h.api.get.mock.calls[h.api.get.mock.calls.length - 1][0], 'http://localhost').searchParams.has('status')).toBe(false);
    }
  });
});

describe('unchanged real API prefix and serialization', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  it.each(['', '/finalize'])('preserves /api/v1 prefix and existing ID encoding for PATCH %s', async suffix => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({}) });
    const body = suffix ? {} : { notes: 'unchanged' };
    await realApi.patch(`${ROOT}/${row.id}${suffix}`, body);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(new URL(url).pathname).toBe(`/api/v1${ROOT}/${row.id}${suffix}`);
    expect(options.method).toBe('PATCH'); expect(options.body).toBe(JSON.stringify(body));
  });

  it('COST-R2D-B3 lib clients hit the real API prefix with encoded IDs and serialized bodies', async () => {
    const lib = require('../src/lib/overhead-allocation');
    global.fetch = jest.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({}) });
    await lib.postAllocationToLedger(row.id);
    await lib.getAllocationReconciliation(row.id);
    await lib.reverseAllocationLedgerLine(row.id, 'line-1', 'reason عربي');
    const calls = (global.fetch as jest.Mock).mock.calls;
    const [url0, opt0] = calls[0];
    expect(new URL(url0).pathname).toBe(`/api/v1${ROOT}/${row.id}/post-to-ledger`);
    expect(opt0.method).toBe('POST'); expect(opt0.body).toBe(JSON.stringify({}));
    const [url1, opt1] = calls[1];
    expect(new URL(url1).pathname).toBe(`/api/v1${ROOT}/${row.id}/reconciliation`);
    expect(opt1.method).toBe('GET'); expect(opt1.body).toBeUndefined();
    const [url2, opt2] = calls[2];
    expect(new URL(url2).pathname).toBe(`/api/v1${ROOT}/${row.id}/ledger-reversal`);
    expect(opt2.method).toBe('POST'); expect(opt2.body).toBe(JSON.stringify({ allocationLineId: 'line-1', reason: 'reason عربي' }));
  });
});
