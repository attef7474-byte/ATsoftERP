import React from 'react';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
const { act, create } = require('react-test-renderer');
let mockLocale: 'ar' | 'en' = 'ar';
let mockContext: any, mockVersion = 1, mockActions: any[] = [];
const mockDialog = jest.fn(), mockOpen = jest.fn(async (..._args: any[]) => {});
const mockTranslate = (key: string): string => key.split('.').reduce<any>((node, part) => node?.[part], mockLocale === 'ar' ? ar : en) ?? key;
jest.mock('../src/lib/i18n/use-translation', () => ({ useTranslation: () => ({ t: mockTranslate, locale: mockLocale, dir: mockLocale === 'ar' ? 'rtl' : 'ltr' }) }));
jest.mock('../src/lib/auth-context', () => ({ useAuth: () => ({ activeContext: mockContext, contextVersion: mockVersion, contextLoading: false, user: { id: 'test-reviewer', name: 'Reviewer' }, isArchivedContext: false }) }));
jest.mock('../src/components/admin/error-modal', () => ({ useErrorModal: () => ({ showError: mockDialog }) }));
jest.mock('../src/components/print/print-runtime', () => ({ openPrintDocument: (...args: any[]) => mockOpen(...args) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../src/components/admin/toast-provider', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/components/admin/admin-action-bar', () => ({ useRegisterAdminActions: (actions: any[]) => { mockActions = actions; }, useStableHandlers: (handlers: any) => ({ exec: (name: string) => handlers[name]() }), ActionBackIcon: () => null, ActionRefreshIcon: () => null, ActionPrintIcon: () => null }));
jest.mock('../src/components/f9', () => ({ F9Lookup: (props: any) => React.createElement('input', { ...props, type: 'lookup' }), productionLineAdapter: {}, machineAdapter: {}, machineComponentAdapter: {}, operationTypeAdapter: {}, costCenterAdapter: {}, sparePartAdapter: {}, userAdapter: {} }));
jest.mock('../src/components/admin/ui', () => ({
  Input: (props: any) => React.createElement('input', props), Select: (props: any) => React.createElement('select', props), Button: (props: any) => React.createElement('button', props, props.children), DataTable: () => null, Pagination: () => null, LocalizedValue: () => null,
}));
jest.mock('../src/components/reports/ReportPageShell', () => ({ ReportPageShell: ({ children, filters }: any) => React.createElement('main', null, filters, children) }));
jest.mock('../src/components/reports/ReportSummaryCards', () => ({ ReportSummaryCards: () => null }));
jest.mock('../src/lib/api', () => ({ api: { get: jest.fn() } }));
const Page = require('../src/app/admin/reports/maintenance/requests/page').default;
const api = require('../src/lib/api').api;

describe('maintenance request real page → unified print preparation', () => {
  let tree: any;
  const response = (params: any, total = 121) => ({ rows: Array.from({ length: Math.min(params.pageSize, Math.max(0, total - (params.page - 1) * params.pageSize)) }, (_, i) => ({ id: `id-${(params.page - 1) * params.pageSize + i}`, requestNumber: `MR-${(params.page - 1) * params.pageSize + i}`, title: 'صيانة Packing', machine: { name: 'Machine' }, type: 'CORRECTIVE', priority: 'HIGH', status: 'OPEN', createdAt: '2026-11-10T00:00:00Z' })), cards: [{ label: 'totalRequests', value: total }], total, page: params.page, pageSize: params.pageSize, totalPages: Math.ceil(total / params.pageSize) });
  const printAction = () => mockActions.find(action => action.id === 'print');
  beforeEach(async () => {
    jest.clearAllMocks(); mockVersion = 1; mockLocale = 'ar'; mockContext = { companyId: 'company-a', branchId: 'branch-a', companyName: 'شركة أ', branchName: 'فرع أ' };
    api.get.mockImplementation(async (_path: string, { params }: any) => response(params));
    await act(async () => { tree = create(React.createElement(Page)); });
  });
  afterEach(() => { act(() => tree?.unmount()); });
  it.each(['ar', 'en'] as const)('uses the same reviewed all-filtered model for Print and PDF in %s', async locale => {
    mockLocale = locale; await act(async () => { tree.update(React.createElement(Page)); });
    await act(async () => { await printAction().onClick(); });
    const first = mockOpen.mock.calls[0][0]; expect(first.company).toBe('شركة أ'); expect(first.branch).toBe('فرع أ'); expect(first.printedBy).toBe('Reviewer'); expect(first.locale).toBe(locale); expect(first.sections[0].rows).toHaveLength(121); expect(first.summary[0].value).toBe('121'); expect(first.filters).toEqual([]);
    const pdf = tree.root.findAllByType('button').find((button: any) => button.children.includes(mockTranslate('reports.exportPdf')));
    await act(async () => { await pdf.props.onClick(); });
    const second = mockOpen.mock.calls[1][0];
    expect(second.sections[0].rows).toEqual(first.sections[0].rows);
    const values = (model: any) => model.sections[0].columns.map((column: any) => ({ key: column.key, label: column.label, values: model.sections[0].rows.map(column.value) }));
    expect(values(second)).toEqual(values(first)); expect(second.filters).toEqual(first.filters); expect(second.title).toBe(first.title); expect(second.company).toBe(first.company);
    expect(api.get.mock.calls.filter((call: any) => call[1].params.pageSize === 100).map((call: any) => call[1].params.page)).toEqual([1, 2, 1, 2]);
  });
  it('prints actual applied date/priority and readable lookup labels', async () => {
    const inputs = tree.root.findAllByType('input'); const dates = inputs.filter((input: any) => input.props.type === 'date');
    await act(async () => { dates[0].props.onChange({ target: { value: '2026-11-01' } }); dates[1].props.onChange({ target: { value: '2026-11-10' } }); tree.root.findAllByType('select')[2].props.onChange({ target: { value: 'HIGH' } }); inputs[0].props.onChange('private-line-id'); inputs[0].props.onItemSelect({ code: 'LINE-1', name: 'خط التغليف' }); });
    await act(async () => { await printAction().onClick(); });
    const printed = mockOpen.mock.calls[0][0]; expect(printed.periodStart).toBe('2026-11-01'); expect(printed.periodEnd).toBe('2026-11-10'); expect(printed.filters).toEqual(expect.arrayContaining([{ label: mockTranslate('reports.priority'), value: 'عالية' }, { label: mockTranslate('maintenance.productionLine'), value: 'خط التغليف' }]));
    expect(printed.sections[0].columns.find((column: any) => column.key === 'productionLine').value({})).toBe('خط التغليف');
  });
  it('keeps the screen data and shows a localized error when preparing print fails', async () => {
    api.get.mockRejectedValueOnce(new Error('فشل تحميل بيانات الطباعة'));
    await act(async () => { await printAction().onClick(); });
    expect(mockOpen).not.toHaveBeenCalled(); expect(mockDialog).toHaveBeenCalled(); expect(mockDialog.mock.calls[0][0].message).toContain('فشل تحميل'); expect(printAction().enabled).toBe(true);
  });
  it('rejects over-limit datasets visibly and never opens an empty document', async () => {
    api.get.mockImplementationOnce(async (_path: string, { params }: any) => response(params, 501));
    await act(async () => { await printAction().onClick(); });
    expect(mockOpen).not.toHaveBeenCalled(); expect(mockDialog.mock.calls[0][0].message).toBe(mockTranslate('reports.printDocument.limitExceeded'));
  });
  it('suppresses immediate duplicate clicks while a request is in flight', async () => {
    let finish!: (value: any) => void; api.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let pending: Promise<void>; await act(async () => { pending = printAction().onClick(); await printAction().onClick(); }); expect(api.get.mock.calls.filter((call: any) => call[1].params.pageSize === 100)).toHaveLength(1);
    await act(async () => { finish(response({ page: 1, pageSize: 100 }, 1)); await pending!; }); expect(mockOpen).toHaveBeenCalledTimes(1);
  });
  it('discards an in-flight print when the company changes', async () => {
    let finish!: (value: any) => void; api.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let pending: Promise<void>; await act(async () => { pending = printAction().onClick(); });
    await act(async () => { mockContext = { companyId: 'company-b', branchId: 'branch-b', companyName: 'شركة ب' }; mockVersion++; tree.update(React.createElement(Page)); });
    await act(async () => { finish(response({ page: 1, pageSize: 100 }, 1)); await pending!; });
    expect(mockOpen).not.toHaveBeenCalled(); expect(mockDialog.mock.calls[0][0].message).toBe(mockTranslate('reports.printDocument.contextChanged'));
  });
  it('does not open a print document after leaving the page during preparation', async () => {
    let finish!: (value: any) => void; api.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let pending: Promise<void>; await act(async () => { pending = printAction().onClick(); });
    act(() => { tree.unmount(); });
    await act(async () => { finish(response({ page: 1, pageSize: 100 }, 1)); await pending!; });
    expect(mockOpen).not.toHaveBeenCalled(); expect(mockDialog).not.toHaveBeenCalled();
  });
});
