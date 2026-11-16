import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { systemAuditPrintModel, type AuditPrintData } from '../src/components/print/system-audit-print';
import { PrintDocument } from '../src/components/print/PrintDocument';
const { act, create } = require('react-test-renderer');
let mockLocale: 'en' | 'ar' = 'en', mockActions: any[] = [];
const mockT = (key: string): string => { const value = key.split('.').reduce<any>((node, part) => node?.[part], mockLocale === 'ar' ? ar : en); if (typeof value !== 'string') throw new Error(`Missing ${key}`); return value; };
const mockOpen = jest.fn(async (..._args: any[]) => {}), mockDialog = jest.fn();
jest.mock('../src/lib/i18n/use-translation', () => ({ useTranslation: () => ({ t: mockT, locale: mockLocale }) }));
jest.mock('../src/lib/auth-context', () => ({ useAuth: () => ({ activeContext: { companyId: 'company-a', branchId: 'branch-a', companyName: 'Company A', branchName: 'Branch A' }, contextVersion: 1, contextLoading: false, user: { id: 'reviewer', name: 'Reviewer' } }) }));
jest.mock('../src/components/admin/error-modal', () => ({ useErrorModal: () => ({ showError: mockDialog }) }));
jest.mock('../src/components/print/print-runtime', () => ({ openPrintDocument: (...args: any[]) => mockOpen(...args) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../src/components/admin/toast-provider', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/components/admin/admin-action-bar', () => ({ useRegisterAdminActions: (actions: any[]) => { mockActions = actions; }, useStableHandlers: (handlers: any) => ({ exec: (name: string) => handlers[name]() }), ActionBackIcon: () => null, ActionRefreshIcon: () => null, ActionPrintIcon: () => null }));
jest.mock('../src/components/admin/ui', () => ({ Select: (props: any) => React.createElement('select', props), LocalizedValue: () => null, Input: (props: any) => React.createElement('input', props), Button: ({ children, ...props }: any) => React.createElement('button', props, children), DataTable: () => null, Pagination: () => null }));
jest.mock('../src/components/reports', () => ({ ReportPageShell: ({ children, filters }: any) => React.createElement('section', null, filters, children), ReportSummaryCards: () => null, ReportExportButton: (props: any) => React.createElement('button', { onClick: props.onPrint, 'data-pdf': true, disabled: props.printDisabled }) }));
jest.mock('../src/lib/api', () => ({ api: { get: jest.fn() } }));
const Page = require('../src/app/admin/reports/audit/page').default;
const api = require('../src/lib/api').api;

const fixture = (): AuditPrintData => ({
  rows: [{ id: 'private-audit', action: 'CREATE', entity: 'MaintenanceRequest', user: { name: 'Reviewer' }, details: 'Created request MR-001', createdAt: '2026-11-12T09:30:00Z' }],
  total: 1, page: 1, pageSize: 20, totalPages: 1,
  cards: [{ label: 'totalAuditEntries', value: 1 }, { label: 'uniqueActions', value: 1 }, { label: 'uniqueEntities', value: 1 }],
  byAction: [{ action: 'CREATE', count: 1 }],
  byEntity: [{ entity: 'MaintenanceRequest', count: 1 }],
  topUsers: [{ userId: 'private-user', count: 1 }],
});

describe('audit trail business print', () => {
  it.each(['ar', 'en'] as const)('renders %s recorded actions without user IDs or technical IDs', locale => {
    mockLocale = locale; const model = systemAuditPrintModel({ data: fixture(), params: {}, labels: {}, scopeKey: 'scope' }, mockT, locale);
    const html = renderToStaticMarkup(React.createElement(PrintDocument, { model: { ...model, locale, company: 'Company A', printedAt: new Date(), timeZone: 'Asia/Aden' }, t: mockT }));
    expect(model.sections[0].columns.map(column => column.key)).toEqual(['action', 'entity', 'user', 'details', 'createdAt']);
    expect(model.summary).toHaveLength(3);
    expect(html).toContain('Reviewer'); expect(html).toContain('Created request MR-001');
    expect(html).toContain(mockT('reports.printDocument.auditSecurityNote'));
    expect(html).not.toMatch(/private-audit|private-user|<button|<input|<nav|NaN|Invalid Date/);
  });
  it.each(['ar', 'en'] as const)('redacts tenant and record IDs from %s audit detail payloads', locale => {
    mockLocale = locale; const data = fixture();
    data.rows = [{ id: 'private-audit', action: 'COMPLETE', entity: 'MaintenanceRequest', user: { name: 'Reviewer' }, details: JSON.stringify({ companyId: 'cmrvaph2200009g95oj1o8m1j', branchId: 'cmrvaph4100019g95kisacppa', requestId: 'cmv7gcjiw0001n495jvgazkma', oldStatus: 'IN_PROGRESS', newStatus: 'COMPLETED', workPerformed: 'TEST work performed' }), createdAt: '2026-11-12T09:30:00Z' }];
    const model = systemAuditPrintModel({ data, params: {}, labels: {}, scopeKey: 'scope' }, mockT, locale);
    const html = renderToStaticMarkup(React.createElement(PrintDocument, { model: { ...model, locale, company: 'Company A', printedAt: new Date(), timeZone: 'Asia/Aden' }, t: mockT }));
    expect(html).toContain(mockT('status.IN_PROGRESS')); expect(html).toContain(mockT('status.COMPLETED')); expect(html).toContain('TEST work performed');
    expect(html).not.toMatch(/cm[a-z0-9]{20,}|companyId|branchId|requestId/);
  });
  it.each(['ar', 'en'] as const)('renders the %s empty state when no audit entries exist', locale => {
    mockLocale = locale; const empty: AuditPrintData = { rows: [], total: 0, page: 1, pageSize: 20, totalPages: 0, cards: [{ label: 'totalAuditEntries', value: 0 }, { label: 'uniqueActions', value: 0 }, { label: 'uniqueEntities', value: 0 }], byAction: [], byEntity: [], topUsers: [] };
    const model = systemAuditPrintModel({ data: empty, params: {}, labels: {}, scopeKey: 'scope' }, mockT, locale);
    const html = renderToStaticMarkup(React.createElement(PrintDocument, { model: { ...model, locale, company: 'Company A', printedAt: new Date(), timeZone: 'Asia/Aden' }, t: mockT }));
    expect(html).toContain(mockT('reports.printDocument.empty')); expect(html).not.toMatch(/NaN|Invalid Date|<button|<input/);
  });
  it('rejects a dataset above the print row limit', () => {
    const data = fixture(); data.rows = Array.from({ length: 501 }, (_, i) => ({ ...data.rows[0], id: 'row-' + i }));
    expect(() => systemAuditPrintModel({ data, params: {}, labels: {}, scopeKey: 'scope' }, mockT, 'en')).toThrow('limitExceeded');
  });
});

describe('actual audit page through shared engine', () => {
  let tree: any; const action = () => mockActions.find(item => item.id === 'print');
  beforeEach(async () => { jest.clearAllMocks(); mockLocale = 'en'; api.get.mockImplementation(async (_route: string, options: any) => ({ ...fixture(), page: options.params.page, pageSize: options.params.pageSize, totalPages: Math.ceil(1 / options.params.pageSize) })); await act(async () => { tree = create(React.createElement(Page)) }); });
  afterEach(() => act(() => tree.unmount()));
  it('prints the bounded canonical audit rows without a second screen read', async () => {
    const pdf = tree.root.findAllByType('button').find((button: any) => button.props['data-pdf']); await act(async () => { await pdf.props.onClick() });
    expect(api.get.mock.calls.at(-1)[0]).toBe('/reports/audit'); expect(api.get.mock.calls.at(-1)[1].params).toMatchObject({ page: 1, pageSize: 100 });
    expect(mockOpen.mock.calls[0][0].company).toBe('Company A'); expect(mockOpen.mock.calls[0][0].title).toBe(mockT('reports.auditTrailReport'));
  });
  it('opens no document if a later collection page is denied', async () => {
    api.get.mockImplementation(async (_route: string, options: any) => { if (options.params.page === 2) throw new Error('Denied'); return { ...fixture(), total: 101, totalPages: 2, pageSize: 100, page: options.params.page, rows: Array.from({ length: 100 }, (_, i) => ({ ...fixture().rows[0], id: 'row-' + i })) }; });
    await act(async () => { await action().onClick() }); expect(mockOpen).not.toHaveBeenCalled(); expect(mockDialog).toHaveBeenCalled(); expect(api.get.mock.calls.at(-1)[1].params.page).toBe(2);
  });
  it('invalidates the print snapshot after a failed refresh', async () => {
    api.get.mockRejectedValueOnce(new Error('Denied')); await act(async () => { await mockActions.find(item => item.id === 'refresh').onClick() });
    expect(action().enabled).toBe(false); await act(async () => { await action().onClick() }); expect(mockOpen).not.toHaveBeenCalled();
  });
});
