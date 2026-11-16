import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { maintenanceKpisPrintModel, type MaintenanceKpisPrintData } from '../src/components/print/maintenance-kpis-print';
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
jest.mock('../src/components/admin/admin-action-bar', () => ({ useRegisterAdminActions: (actions: any[]) => { mockActions = actions; }, useStableHandlers: (handlers: any) => ({ exec: (name: string) => handlers[name]() }), ActionBackIcon: () => null, ActionRefreshIcon: () => null, ActionPrintIcon: () => null }));
jest.mock('../src/components/f9', () => ({ F9Lookup: (props: any) => React.createElement('input', { ...props, type: 'lookup' }), productionLineAdapter: {}, machineAdapter: {}, operationTypeAdapter: {}, costCenterAdapter: {} }));
jest.mock('../src/components/admin/ui', () => ({ Input: (props: any) => React.createElement('input', props), Button: ({ children, ...props }: any) => React.createElement('button', props, children), Card: ({ children }: any) => React.createElement('section', null, children), CardContent: ({ children }: any) => React.createElement('div', null, children), CardHeader: ({ children }: any) => React.createElement('header', null, children), LoadingState: () => null, ErrorState: () => null, PageHeader: () => null }));
jest.mock('../src/lib/api', () => ({ api: { get: jest.fn() } }));
const Page = require('../src/app/admin/reports/maintenance/kpis/page').default, api = require('../src/lib/api').api;
const fixture = (): MaintenanceKpisPrintData => ({ kpi: { cards: [{ label: 'totalRequests', value: 4 }, { label: 'openBacklog', value: 3 }, { label: 'totalDowntime', value: 90, unit: 'minutes' }, { label: 'pmCmRatio', value: 64, unit: '%' }, { label: 'emergencyPercentage', value: null, unit: '%' }, { label: 'totalCost', value: 12.5 }] }, reliability: { repeatFailureRate: 25, totalEvents: 4 }, compliance: { cards: [{ label: 'totalSchedules', value: 5 }, { label: 'complianceRate', value: 80, unit: '%' }] } });

describe('KPI print model', () => {
  it.each(['ar', 'en'] as const)('renders %s with explicit per-metric scopes and percentage/null semantics', locale => {
    mockLocale = locale;
    const model = maintenanceKpisPrintModel({ data: fixture(), params: { dateFrom: '2026-11-01', dateTo: '2026-11-10' }, labels: {}, scopeKey: 'scope' }, mockT, locale);
    const html = renderToStaticMarkup(React.createElement(PrintDocument, { model: { ...model, locale, company: 'Company A', printedAt: new Date(), timeZone: 'Asia/Aden' }, t: mockT }));
    expect(html).toContain(mockT('reports.printDocument.kpiContextPeriod')); expect(html).toContain(mockT('reports.printDocument.kpiSelectedAllDates')); expect(html).toContain('64'); expect(html).toContain('%'); expect(html).toContain('—'); expect(html).not.toMatch(/<input|<button|<nav|reports\.printDocument\./);
    expect(model.sections[0].rows[3].value).toContain('64'); expect(model.sections[0].rows[4].value).toBe('—');
    expect(model.periodStart).toBe('2026-11-01'); expect(model.periodEnd).toBe('2026-11-10');
  });
  it('discloses the existing line-over-machine selection rule for reliability', () => {
    const model = maintenanceKpisPrintModel({ data: fixture(), params: { productionLineId: 'private-line', machineId: 'private-machine' }, labels: { productionLineId: 'Line A', machineId: 'Machine A' }, scopeKey: 'scope' }, mockT, mockLocale);
    expect(model.sections[1].rows[0].scope).toBe(mockT('reports.printDocument.kpiReliabilityLineScope'));
    expect(JSON.stringify(model)).not.toContain('private-');
  });
});

describe('actual KPI page → successful multi-endpoint snapshot', () => {
  let tree: any;
  beforeEach(async () => { jest.clearAllMocks(); mockLocale = 'en'; const data = fixture(); api.get.mockImplementation(async (route: string) => route.includes('kpi-overview') ? data.kpi : route.includes('repeat-failure') ? data.reliability : data.compliance); await act(async () => { tree = create(React.createElement(Page)); }); });
  afterEach(() => act(() => tree.unmount()));
  const action = () => mockActions.find(item => item.id === 'print');
  it('prints all three successful sources without extra API reads', async () => {
    expect(api.get).toHaveBeenCalledTimes(3); await act(async () => { await action().onClick(); }); expect(api.get).toHaveBeenCalledTimes(3); expect(mockOpen.mock.calls[0][0].sections).toHaveLength(3);
  });
  it('captures the actual applied dates for all source requests', async () => {
    const dates = tree.root.findAllByType('input').filter((input: any) => input.props.type === 'date');
    await act(async () => { dates[0].props.onChange({ target: { value: '2026-11-01' } }); dates[1].props.onChange({ target: { value: '2026-11-10' } }); });
    await act(async () => { await action().onClick(); }); expect(mockOpen.mock.calls[0][0].periodStart).toBe('2026-11-01'); expect(api.get.mock.calls.slice(-3).every((call: any) => call[1].params.dateTo === '2026-11-10')).toBe(true);
  });
  it('does not print a partial snapshot when one endpoint fails', async () => {
    api.get.mockRejectedValueOnce(new Error('Denied')); await act(async () => { await mockActions.find(item => item.id === 'refresh').onClick(); }); expect(action().enabled).toBe(false);
    await act(async () => { await action().onClick(); }); expect(mockOpen).not.toHaveBeenCalled(); expect(mockDialog).toHaveBeenCalled();
  });
});
