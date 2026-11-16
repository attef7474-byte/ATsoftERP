import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { maintenanceOverviewPrintModel, type MaintenanceOverviewPrintData } from '../src/components/print/maintenance-overview-print';
import { PrintDocument } from '../src/components/print/PrintDocument';
const { act, create } = require('react-test-renderer');
let mockLocale: 'en' | 'ar' = 'en', mockActions: any[] = [];
const mockT = (key: string): string => { const value = key.split('.').reduce<any>((data, part) => data?.[part], mockLocale === 'ar' ? ar : en); if (typeof value !== 'string') throw new Error(`Missing ${key}`); return value; };
const mockOpen = jest.fn(async (..._args: any[]) => {}), mockDialog = jest.fn();
jest.mock('../src/lib/i18n/use-translation', () => ({ useTranslation: () => ({ t: mockT, locale: mockLocale }) }));
jest.mock('../src/lib/auth-context', () => ({ useAuth: () => ({ activeContext: { companyId: 'company-a', branchId: 'branch-a', companyName: 'Company A', branchName: 'Branch A' }, contextVersion: 1, contextLoading: false, user: { id: 'reviewer', name: 'Reviewer' } }) }));
jest.mock('../src/components/admin/error-modal', () => ({ useErrorModal: () => ({ showError: mockDialog }) }));
jest.mock('../src/components/print/print-runtime', () => ({ openPrintDocument: (...args: any[]) => mockOpen(...args) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../src/components/admin/toast-provider', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/components/admin/admin-action-bar', () => ({ useRegisterAdminActions: (actions: any[]) => { mockActions = actions; }, useStableHandlers: (handlers: any) => ({ exec: (name: string) => handlers[name]() }), ActionBackIcon: () => null, ActionRefreshIcon: () => null, ActionPrintIcon: () => null }));
jest.mock('../src/components/f9', () => ({ F9Lookup: (props: any) => React.createElement('input', props), productionLineAdapter: {}, machineAdapter: {}, machineComponentAdapter: {}, operationTypeAdapter: {}, costCenterAdapter: {} }));
jest.mock('../src/components/admin/ui', () => ({ Card: ({ children }: any) => React.createElement('section', null, children), CardContent: ({ children }: any) => React.createElement('div', null, children), CardHeader: ({ children }: any) => React.createElement('header', null, children), Button: ({ children, ...props }: any) => React.createElement('button', props, children), DataTable: () => null, LocalizedValue: () => null }));
jest.mock('../src/components/reports/ReportPageShell', () => ({ ReportPageShell: ({ children, filters }: any) => React.createElement('main', null, filters, children) }));
jest.mock('../src/components/reports/ReportSummaryCards', () => ({ ReportSummaryCards: () => null }));
jest.mock('../src/lib/api', () => ({ api: { get: jest.fn() } }));
const Page = require('../src/app/admin/reports/maintenance/page').default;
const api = require('../src/lib/api').api;

export const overviewFixture = (): MaintenanceOverviewPrintData => ({ totalRequests: 1, openRequests: 1, inProgressRequests: 0, completedRequests: 0, cancelledRequests: 0, overdueSchedules: 2, totalDowntimeMinutes: 90, activeDowntime: 3, totalCost: 150, partsUsageCount: 4, requestsByStatus: [{ status: 'OPEN', count: 1 }], requestsByPriority: [{ priority: 'HIGH', count: 1 }], requestsByType: [{ type: 'CORRECTIVE', count: 1 }], topMachinesByRequestCount: [{ machineId: 'private-machine-id', count: 1 }, { machineId: 'unknown-machine-id', count: 1 }], topMachinesByDowntime: [{ machineId: 'private-machine-id', totalMinutes: 90 }], dueSchedules: [{ id: 'private-schedule-id', title: 'فحص Packing', machine: { id: 'private-machine-id', name: 'ماكينة Packing' }, endDate: '2026-11-10T00:00:00Z', status: 'ACTIVE' }], recentRequests: [{ id: 'private-request-id', requestNumber: 'MR-1001', title: 'صيانة Packing', machine: { id: 'private-machine-id', name: 'ماكينة Packing' }, status: 'OPEN', createdAt: '2026-11-10T00:00:00Z' }] });

describe('maintenance overview business print', () => {
  it.each(['ar', 'en'] as const)('renders %s with explicit section scopes, readable names and no technical IDs', locale => {
    mockLocale = locale;
    const model = maintenanceOverviewPrintModel({ data: overviewFixture(), params: { productionLineId: 'private-line-id' }, labels: { productionLineId: 'Line 1' }, scopeKey: 'scope' }, mockT, locale);
    const html = renderToStaticMarkup(React.createElement(PrintDocument, { model: { ...model, locale, company: 'Company A', branch: 'Branch A', printedAt: new Date(), timeZone: 'Asia/Aden' }, t: mockT }));
    expect(html).toContain('MR-1001'); expect(html).toContain('ماكينة Packing'); expect(html).toContain('Line 1'); expect(html).toContain(mockT('reports.printDocument.entireContextTotals')); expect(html).toContain(mockT('reports.printDocument.missingMachineNames')); expect(html).toContain(mockT('reports.printDocument.legacyCostNote'));
    expect(html).not.toMatch(/private-|unknown-machine|<button|<input|<nav|lockVersion/); expect(html).toContain('>150<'); expect(html).toContain('>90<');
    expect(model.scopeLabel).toContain('10'); expect(model.sections).toHaveLength(8);
  });
  it('requires readable lookup labels rather than printing their IDs', () => {
    expect(() => maintenanceOverviewPrintModel({ data: overviewFixture(), params: { machineId: 'hidden-id' }, labels: {}, scopeKey: 'scope' }, mockT, mockLocale)).toThrow('unavailable');
  });
  it('produces professional empty sections without raw IDs or invented machine identities', () => {
    const data = overviewFixture(); data.recentRequests = []; data.dueSchedules = [];
    const model = maintenanceOverviewPrintModel({ data, params: {}, labels: {}, scopeKey: 'scope' }, mockT, mockLocale);
    expect(model.sections[3].columns[0].value(data.topMachinesByRequestCount[0])).toBeUndefined();
    expect(model.sections[5].rows).toEqual([]); expect(model.filters).toEqual([]);
  });
});

describe('actual overview page capture → shared engine', () => {
  let tree: any;
  beforeEach(async () => { jest.clearAllMocks(); mockLocale = 'en'; api.get.mockResolvedValue(overviewFixture()); await act(async () => { tree = create(React.createElement(Page)); }); });
  afterEach(() => act(() => tree.unmount()));
  const action = () => mockActions.find(item => item.id === 'print');
  it('uses the successful screen dataset and does not duplicate heavy report reads for print', async () => {
    expect(api.get).toHaveBeenCalledTimes(1); await act(async () => { await action().onClick(); });
    expect(mockOpen).toHaveBeenCalledTimes(1); expect(api.get).toHaveBeenCalledTimes(1);
    expect(mockOpen.mock.calls[0][0].company).toBe('Company A'); expect(mockOpen.mock.calls[0][0].title).toBe(mockT('reports.maintenanceOverview'));
  });
  it('prints actual successfully applied lookup state after refresh', async () => {
    const lookup = tree.root.findAllByType('input')[0];
    await act(async () => { lookup.props.onChange('line-id'); lookup.props.onItemSelect({ name: 'Line A', code: 'LINE-A' }); });
    await act(async () => { await action().onClick(); });
    expect(api.get.mock.calls.at(-1)[1].params.productionLineId).toBe('line-id');
    expect(mockOpen.mock.calls[0][0].filters).toEqual([{ label: mockT('maintenance.productionLine'), value: 'Line A' }]);
  });
  it('disables print and invalidates the snapshot after a failed screen fetch', async () => {
    api.get.mockRejectedValueOnce(new Error('Report failed')); await act(async () => { await mockActions.find(item => item.id === 'refresh').onClick(); });
    expect(action().enabled).toBe(false); await act(async () => { await action().onClick(); }); expect(mockOpen).not.toHaveBeenCalled(); expect(mockDialog).toHaveBeenCalled();
  });
});
