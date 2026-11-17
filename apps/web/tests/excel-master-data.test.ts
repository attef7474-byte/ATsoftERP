import React from 'react';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
const { act, create } = require('react-test-renderer');
let mockLocale = 'en';
let mockAuth: any;
const mockPost = jest.fn(), mockDownload = jest.fn(), mockError = jest.fn(), mockToast = jest.fn();
const mockT = (key: string): string => { const value = key.split('.').reduce<any>((v, k) => v?.[k], mockLocale === 'en' ? en : ar); if (typeof value !== 'string') throw new Error(`Missing ${key}`); return value; };
jest.mock('../src/lib/i18n/use-translation', () => ({ useTranslation: () => ({ t: mockT, locale: mockLocale, dir: mockLocale === 'ar' ? 'rtl' : 'ltr' }) }));
jest.mock('../src/lib/auth-context', () => ({ useAuth: () => mockAuth }));
jest.mock('../src/lib/api', () => ({ api: { post: (...args: any[]) => mockPost(...args), download: (...args: any[]) => mockDownload(...args) } }));
jest.mock('../src/components/admin/error-handler', () => ({ useApiErrorHandler: () => mockError }));
jest.mock('../src/components/admin/toast-provider', () => ({ useToast: () => ({ showToast: mockToast }) }));
jest.mock('../src/components/admin/ui', () => ({
  Button: ({ children, ...props }: any) => React.createElement('button', props, children),
  Modal: ({ open, children }: any) => open ? React.createElement('section', { role: 'dialog' }, children) : null,
  Select: ({ options, ...props }: any) => React.createElement('select', props, options.map((o: any) => React.createElement('option', { key: o.value, value: o.value }, o.label))),
}));
import { ExcelMasterDataActions } from '../src/components/admin/excel-master-data-actions';
const summary = { totalRows: 1, created: 1, updated: 0, unchanged: 0, failed: 0, skipped: 0, warnings: 0 };
const preview = { token: 'opaque-token', canImport: true, summary, warnings: [], rows: [{ row: 2, code: '001', name: 'Name', action: 'NEW', errors: [] }] };
let tree: any;
function button(key: string) { return tree.root.findAllByType('button').find((node: any) => node.props.children === mockT('common.excel.'+key)); }
async function click(key: string) { await act(async () => { await button(key).props.onClick(); }); }
async function mount(props: any = {}) { await act(async () => { tree = create(React.createElement(ExcelMasterDataActions, { entity: 'products', search: 'pump', onImported: jest.fn(), ...props })); }); }
async function selectFile() { await act(async () => { tree.root.findByProps({ type: 'file' }).props.onChange({ target: { files: [new Blob(['xlsx'])] } }); }); }
beforeEach(() => { jest.clearAllMocks(); mockLocale = 'en'; mockAuth = { contextVersion: 1, contextReady: true, isSuperAdmin: false, permissions: { permissions: ['products:read','products:create','products:update'] } }; mockPost.mockResolvedValue(preview); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; });
describe('shared master-data Excel UI', () => {
  it.each(['en','ar'])('runs explicit preview → confirmation → import in %s', async locale => {
    mockLocale = locale; const onImported = jest.fn(); await mount({ onImported }); await click('import');
    expect(tree.root.findByType('select').props.value).toBe('CREATE_ONLY'); expect(JSON.stringify(tree.toJSON())).toContain(mockT('common.excel.shared'));
    expect(button('validate').props.disabled).toBe(true); await selectFile(); await click('validate');
    expect(mockPost.mock.calls[0][0]).toBe('/master-data-excel/products/validate'); expect(mockPost.mock.calls[0][1].get('mode')).toBe('CREATE_ONLY');
    expect(button('confirm').props.disabled).toBe(true);
    await act(async () => tree.root.findByProps({ type: 'checkbox' }).props.onChange({ target: { checked: true } }));
    mockPost.mockResolvedValue(summary); await click('confirm');
    expect(mockPost.mock.calls[1][1].get('token')).toBe('opaque-token'); expect(onImported).toHaveBeenCalledTimes(1); expect(mockToast).toHaveBeenCalledTimes(1);
  });
  it('exposes only permitted modes and hides imports from read-only/archive users', async () => {
    mockAuth.permissions.permissions = ['products:read','products:update']; await mount(); await click('import');
    expect(tree.root.findAllByType('option').map((n: any) => n.props.value)).toEqual(['UPDATE_EXISTING']);
    await act(async () => tree.unmount()); tree = null; mockAuth.isArchivedContext = true; await mount(); expect(button('import')).toBeUndefined(); expect(button('template')).toBeDefined();
  });
  it('hides all actions without read permission', async () => { mockAuth.permissions.permissions = []; await mount(); expect(tree.toJSON()).toBeNull(); });
  it('invalidates the preview after mode or file changes', async () => {
    await mount(); await click('import'); await selectFile(); await click('validate'); expect(button('confirm')).toBeDefined();
    await act(async () => tree.root.findByType('select').props.onChange({ target: { value: 'UPDATE_EXISTING' } })); expect(button('confirm')).toBeUndefined();
    await click('validate'); await selectFile(); expect(button('confirm')).toBeUndefined();
  });
  it('keeps the file and displays canonical errors without importing invalid rows', async () => {
    mockPost.mockResolvedValue({ ...preview, canImport: false, summary: { ...summary, failed: 1 }, rows: [{ ...preview.rows[0], action: 'INVALID', errors: [{ column: 'Name', code: 'validation.excelRequired' }] }] });
    await mount(); await click('import'); await selectFile(); await click('validate'); expect(button('confirm')).toBeUndefined(); expect(button('errors')).toBeDefined(); expect(JSON.stringify(tree.toJSON())).toContain(mockT('validation.excelRequired'));
  });
  it('prevents duplicate requests synchronously and cancels stale context responses', async () => {
    let resolve: any; mockPost.mockReturnValue(new Promise(r => { resolve = r; })); await mount(); await click('import'); await selectFile();
    await act(async () => { button('validate').props.onClick(); button('validate').props.onClick(); }); expect(mockPost).toHaveBeenCalledTimes(1);
    const signal = mockPost.mock.calls[0][2].signal; mockAuth = { ...mockAuth, contextVersion: 2 };
    await act(async () => tree.update(React.createElement(ExcelMasterDataActions, { entity: 'products', search: '', onImported: jest.fn() })));
    expect(signal.aborted).toBe(true); await act(async () => resolve(preview)); expect(tree.root.findAllByProps({ role: 'dialog' })).toHaveLength(0);
  });
  it('retains upload and mode after recoverable API failure', async () => {
    mockPost.mockRejectedValue(new Error('network')); await mount(); await click('import'); await selectFile(); await click('validate'); expect(mockError).toHaveBeenCalled(); expect(button('validate').props.disabled).toBe(false);
  });
});
