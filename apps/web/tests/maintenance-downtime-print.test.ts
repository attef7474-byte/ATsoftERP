import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { maintenanceDowntimePrintModel, type DowntimePrintData } from '../src/components/print/maintenance-downtime-print';
import { PrintDocument } from '../src/components/print/PrintDocument';
const { act, create } = require('react-test-renderer');
let mockLocale: 'ar' | 'en' = 'en', mockActions: any[] = [];
const mockT = (key: string): string => { const value = key.split('.').reduce<any>((node, part) => node?.[part], mockLocale === 'ar' ? ar : en); if (typeof value !== 'string') throw new Error(`Missing ${key}`); return value; };
const mockOpen = jest.fn(async (..._args: any[]) => {}), mockDialog = jest.fn();
jest.mock('../src/lib/i18n/use-translation', () => ({ useTranslation: () => ({ t: mockT, locale: mockLocale }) }));
jest.mock('../src/lib/auth-context', () => ({ useAuth: () => ({ activeContext: { companyId: 'company-a', branchId: 'branch-a', companyName: 'Company A', branchName: 'Branch A' }, contextVersion: 1, contextLoading: false, user: { id: 'reviewer', name: 'Reviewer' } }) }));
jest.mock('../src/components/admin/error-modal', () => ({ useErrorModal: () => ({ showError: mockDialog }) }));
jest.mock('../src/components/print/print-runtime', () => ({ openPrintDocument: (...args: any[]) => mockOpen(...args) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../src/components/admin/toast-provider', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/components/admin/admin-action-bar', () => ({ useRegisterAdminActions: (actions: any[]) => { mockActions = actions; }, useStableHandlers: (handlers: any) => ({ exec: (name: string) => handlers[name]() }), ActionBackIcon: () => null, ActionRefreshIcon: () => null, ActionPrintIcon: () => null }));
jest.mock('../src/components/f9', () => ({ F9Lookup: (props: any) => React.createElement('input', { ...props, type: 'lookup' }), productionLineAdapter: {}, machineAdapter: {}, operationTypeAdapter: {}, costCenterAdapter: {} }));
jest.mock('../src/components/admin/ui', () => ({ Input: (props: any) => React.createElement('input', props), Button: ({ children, ...props }: any) => React.createElement('button', props, children), DataTable: () => null, Pagination: () => null }));
jest.mock('../src/components/reports', () => ({ ReportPageShell: ({ children, filters }: any) => React.createElement('section', null, filters, children), ReportSummaryCards: () => null, ReportExportButton: (props: any) => React.createElement('button', { onClick: props.onPrint, 'data-pdf': true, disabled: props.printDisabled }) }));
jest.mock('../src/lib/api', () => ({ api: { get: jest.fn() } }));
const Page = require('../src/app/admin/reports/maintenance/downtime/page').default, api = require('../src/lib/api').api;
const row = (id = 'private-id') => ({ id, machine: { name: 'Machine A' }, reason: 'Long reason with <script>text</script>', startTime: '2026-11-01T09:30:00Z', endTime: null, durationMinutes: null, cancelledAt: null });
const fixture = (): DowntimePrintData => ({ rows: [row()], total: 1, page: 1, pageSize: 20, totalPages: 1, cards: [{ label: 'totalDowntime', value: 1 }, { label: 'totalDowntimeMinutes', value: 0 }] });

describe('downtime business document', () => {
  it.each(['ar', 'en'] as const)('renders %s recorded duration/status and six independent columns', locale => {
    mockLocale = locale; const data = fixture();
    data.rows.push({ ...row('closed'), endTime: '2026-11-01T10:30:00Z', durationMinutes: 60 }, { ...row('cancelled'), cancelledAt: '2026-11-02' });
    const model = maintenanceDowntimePrintModel({ data, params: { dateFrom: '2026-11-01' }, labels: {}, scopeKey: 'scope' }, mockT, locale);
    const html = renderToStaticMarkup(React.createElement(PrintDocument, { model: { ...model, locale, company: 'Company A', printedAt: new Date(), timeZone: 'Asia/Aden' }, t: mockT }));
    expect(model.sections[0].columns.map(column => column.key)).toEqual(['machine', 'reason', 'startTime', 'endTime', 'durationMinutes', 'status']);
    expect(html).toContain(mockT('reports.cancelled')); expect(html).toContain(mockT('reports.completed')); expect(html).toContain(mockT('reports.active'));
    expect(html).toContain('—'); expect(html).toContain('&lt;script&gt;'); expect(html).not.toMatch(/<script|<button|<input|private-id|Invalid Date|NaN/);
  });
  it('rejects a selected lookup without a readable name', () => {
    expect(() => maintenanceDowntimePrintModel({ data: fixture(), params: { machineId: 'private-id' }, labels: {}, scopeKey: 'scope' }, mockT, 'en')).toThrow('unavailable');
  });
});

describe('actual downtime page → bounded canonical GET → print model', () => {
  let tree: any;
  beforeEach(async () => { jest.clearAllMocks(); mockLocale = 'en'; api.get.mockImplementation(async (_route: string, options: any) => ({ ...fixture(), pageSize: options.params.pageSize })); await act(async () => { tree = create(React.createElement(Page)); }); });
  afterEach(() => act(() => tree.unmount()));
  const action = () => mockActions.find(item => item.id === 'print');
  it('collects all 101 filtered rows and preserves applied names/dates instead of printing UI page one', async () => {
    const lookup = tree.root.findAllByType('input').find((input: any) => input.props.type === 'lookup');
    await act(async () => { lookup.props.onChange('private-line'); lookup.props.onItemSelect({ name: 'Line A' }); });
    const date = tree.root.findAllByType('input').find((input: any) => input.props.type === 'date');
    await act(async () => { date.props.onChange({ target: { value: '2026-11-01' } }); });
    api.get.mockImplementation(async (_route: string, options: any) => ({ ...fixture(), rows: Array.from({ length: options.params.page === 1 ? 100 : 1 }, (_, index) => row(`${options.params.page}-${index}`)), total: 101, totalPages: 2, page: options.params.page, pageSize: options.params.pageSize }));
    await act(async () => { await action().onClick(); });
    const model = mockOpen.mock.calls[0][0]; expect(model.sections[0].rows).toHaveLength(101); expect(model.filters[0].value).toBe('Line A'); expect(model.periodStart).toBe('2026-11-01');
    expect(api.get.mock.calls.slice(-2).map((call: any) => call[1].params.page)).toEqual([1, 2]); expect(api.get.mock.calls.at(-1)[1].params.productionLineId).toBe('private-line');
  });
  it('uses the same prepared business model for PDF', async () => {
    const pdf = tree.root.findAllByType('button').find((button: any) => button.props['data-pdf']);
    await act(async () => { await pdf.props.onClick(); }); expect(mockOpen.mock.calls[0][0].title).toBe(mockT('reports.downtimeReport'));
  });
  it.each(['page failure', 'over 500', 'duplicate row'])('aborts %s without opening a partial document', async failure => {
    if (failure === 'page failure') api.get.mockRejectedValueOnce(new Error('Denied'));
    else if (failure === 'over 500') api.get.mockResolvedValueOnce({ ...fixture(), total: 501, pageSize: 100, totalPages: 6 });
    else api.get.mockResolvedValueOnce({ ...fixture(), rows: [row(), row()], total: 2, pageSize: 100 });
    await act(async () => { await action().onClick(); }); expect(mockOpen).not.toHaveBeenCalled(); expect(mockDialog).toHaveBeenCalled();
  });
  it('invalidates printing after a failed refresh', async () => {
    api.get.mockRejectedValueOnce(new Error('Denied')); await act(async () => { await mockActions.find(item => item.id === 'refresh').onClick(); }); expect(action().enabled).toBe(false);
  });
});
