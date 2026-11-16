import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { operationsPrintModel, type OperationsPrintData } from '../src/components/print/operations-print';
import { PrintDocument } from '../src/components/print/PrintDocument';
const { act, create } = require('react-test-renderer');
let mockLocale: 'en' | 'ar' = 'en';
const mockT = (key: string): string => { const value = key.split('.').reduce<any>((node, part) => node?.[part], mockLocale === 'ar' ? ar : en); if (typeof value !== 'string') throw new Error(`Missing ${key}`); return value; };
const mockOpen = jest.fn(async (..._args: any[]) => {}), mockDialog = jest.fn();
jest.mock('../src/lib/i18n/use-translation', () => ({ useTranslation: () => ({ t: mockT, locale: mockLocale }) }));
jest.mock('../src/lib/auth-context', () => ({ useAuth: () => ({ permissions: { permissions: ['reports.operations:read', 'reports.operations:export'] }, isSuperAdmin: false, activeContext: { companyId: 'company-a', branchId: 'branch-a', companyName: 'Company A', companyNameEn: 'Company A', companyNameAr: 'Company A', branchName: 'Branch A', branchNameEn: 'Branch A', branchNameAr: 'Branch A' }, archivedContext: null, isArchivedContext: false, contextVersion: 1, contextLoading: false, user: { id: 'reviewer', name: 'Reviewer' } }) }));
jest.mock('../src/components/admin/error-modal', () => ({ useErrorModal: () => ({ showError: mockDialog }) }));
jest.mock('../src/components/admin/error-handler', () => ({ useApiErrorHandler: () => mockDialog }));
jest.mock('../src/components/print/print-runtime', () => ({ openPrintDocument: (...args: any[]) => mockOpen(...args) }));
jest.mock('../src/components/admin/toast-provider', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/components/admin/ui', () => ({ Button: ({ children, ...props }: any) => React.createElement('button', props, children), Input: (props: any) => React.createElement('input', props), PageHeader: ({ title, subtitle }: any) => React.createElement('header', null, title, subtitle) }));
jest.mock('../src/components/admin/charts/chart-card', () => ({ ChartCard: ({ title, children }: any) => React.createElement('section', null, title, children) }));
jest.mock('../src/components/f9/F9Lookup', () => ({ F9Lookup: (props: any) => React.createElement('div', { 'data-f9': props.label }) }));
jest.mock('../src/components/f9/lookup-adapters', () => ({ machineAdapter: {}, productionLineAdapter: {} }));
jest.mock('../src/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
const Page = require('../src/app/admin/reports/operations/page').default;
const api = require('../src/lib/api').api;

const overview = () => ({
  formulaVersion: 'PHASE_2_OPERATIONS_V1',
  cardinality: { strategy: 'SECTIONED_AUTHORITY_COMPOSITION', rule: 'Separate sections', cache: 'NONE_TENANT_SAFE_LIVE_QUERY' },
  summary: {
    runCount: 2, plannedMinutes: '120', operatingMinutes: '100', totalOutput: '500', goodOutput: '480',
    factors: {
      availability: { percent: '90', numerator: '90', denominator: '100' },
      performance: { percent: '95', numerator: '95', denominator: '100' },
      quality: { percent: '96', numerator: '480', denominator: '500' },
      oee: { percent: '82.08', numerator: '82.08', denominator: '100' },
    },
    reliability: { mtbf: { mtbfHours: 12 }, mttr: { mttrHours: 2 }, totalDowntime: { totalHours: 8, totalEvents: 3 } },
    operationalCost: { totalAmount: '1500', transactionCount: 4, currencyCode: 'USD' },
  },
  breakdowns: {
    downtimeByMachine: { items: [{ machine: { code: 'MC-01', name: 'Mixer' }, totalHours: 5, eventCount: 2 }] },
    costByEventType: [{ eventType: 'DOWNTIME', amount: '500', count: 1 }, { eventType: 'LABOR', amount: '1000', count: 3 }],
  },
  sourceLineage: [],
});

const run = (index: number) => ({
  productionRunId: `private-run-${index}`, runNumber: `RUN-${index}`, status: 'COMPLETED',
  productionLineCode: 'LINE-1', machineCode: 'MC-01', productCode: 'PROD-1', startedAt: '2026-01-01T08:00:00.000Z',
  metrics: { plannedMinutes: '60', operatingMinutes: '50', totalOutput: '250', goodOutput: '240', oee: { percent: '80', numerator: '80', denominator: '100' } },
});

const drilldown = (total = 2, page = 1, limit = 20) => {
  const start = (page - 1) * limit;
  return {
    oeeFormulaVersion: 'PHASE_1_9_OEE_V1',
    data: Array.from({ length: Math.max(0, Math.min(limit, total - start)) }, (_, i) => run(start + i + 1)),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const fixture = (): OperationsPrintData => ({ overview: overview(), drilldown: drilldown() });

describe('cross-domain operations print', () => {
  it.each(['ar', 'en'] as const)('renders %s run, cost and downtime sections without internal identifiers', locale => {
    mockLocale = locale;
    const model = operationsPrintModel({ data: fixture(), params: { dateFrom: '2026-01-01', dateTo: '2026-01-31', productionLineId: 'line-1' }, labels: { productionLineId: 'Line One' }, scopeKey: 'scope' }, mockT, locale);
    const html = renderToStaticMarkup(React.createElement(PrintDocument, { model: { ...model, locale, company: 'Company A', printedAt: new Date(), timeZone: 'Asia/Aden' }, t: mockT }));
    expect(model.sections[0].columns.map(column => column.key)).toEqual(['run', 'status', 'line', 'machine', 'product', 'startedAt', 'plannedMinutes', 'operatingMinutes', 'output', 'goodOutput', 'oee']);
    expect(model.filters?.[0].value).toBe('Line One');
    expect(html).toContain('RUN-1'); expect(html).toContain('PROD-1');
    expect(html).toContain(mockT('production.runs.runStatus.COMPLETED'));
    expect(html).toContain(mockT('operationsReports.costEventDOWNTIME'));
    expect(html).toContain(mockT('operationsReports.costEventLABOR'));
    expect(html).toContain(mockT('reports.printDocument.operationsNote'));
    expect(html).toContain('PHASE_2_OPERATIONS_V1');
    expect(html).not.toMatch(/private-run|<button|<input|<nav|NaN|Invalid Date/);
  });

  it.each(['ar', 'en'] as const)('renders the %s empty state when no runs match', locale => {
    mockLocale = locale;
    const model = operationsPrintModel({ data: { overview: overview(), drilldown: drilldown(0) }, params: {}, labels: {}, scopeKey: 'scope' }, mockT, locale);
    const html = renderToStaticMarkup(React.createElement(PrintDocument, { model: { ...model, locale, company: 'Company A', printedAt: new Date(), timeZone: 'Asia/Aden' }, t: mockT }));
    expect(html).toContain(mockT('reports.printDocument.empty')); expect(html).not.toMatch(/NaN|Invalid Date|<button|<input/);
  });

  it('rejects a drilldown above the print row limit', () => {
    const data = fixture(); data.drilldown = { ...drilldown(0), data: Array.from({ length: 501 }, (_, i) => run(i)), meta: { page: 1, limit: 500, total: 501, totalPages: 2 } };
    expect(() => operationsPrintModel({ data, params: {}, labels: {}, scopeKey: 'scope' }, mockT, 'en')).toThrow('limitExceeded');
  });
});

describe('actual operations page through shared engine', () => {
  let tree: any;
  const button = (label: string) => tree.root.findAllByType('button').find((item: any) => item.props.children === label);
  beforeEach(async () => {
    jest.clearAllMocks(); mockLocale = 'en';
    api.get.mockImplementation(async (route: string, options: any) => {
      if (route === '/reports/operations/overview') return overview();
      if (route === '/reports/operations/drilldown') return drilldown(120, options.params.page, options.params.limit);
      throw new Error(`Unexpected route ${route}`);
    });
    await act(async () => { tree = create(React.createElement(Page)) });
    await act(async () => { await button(mockT('operationsReports.apply')).props.onClick() });
  });
  afterEach(() => act(() => tree.unmount()));

  it('prints every filtered run through bounded 50-row pages', async () => {
    await act(async () => { await button(mockT('common.print')).props.onClick() });
    const drilldownCalls = api.get.mock.calls.filter((call: any[]) => call[0] === '/reports/operations/drilldown');
    const printCalls = drilldownCalls.filter((call: any[]) => call[1].params.limit === 50);
    expect(printCalls.map((call: any[]) => call[1].params.page)).toEqual([1, 2, 3]);
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockOpen.mock.calls[0][0].title).toBe(mockT('operationsReports.title'));
    expect(mockOpen.mock.calls[0][0].company).toBe('Company A');
    expect(mockOpen.mock.calls[0][0].sections[0].rows).toHaveLength(120);
  });

  it('opens no document if a later collection page is denied', async () => {
    api.get.mockImplementation(async (route: string, options: any) => {
      if (route === '/reports/operations/overview') return overview();
      if (options.params.limit === 50 && options.params.page === 2) throw new Error('Denied');
      return drilldown(120, options.params.page, options.params.limit);
    });
    await act(async () => { await button(mockT('common.print')).props.onClick() });
    expect(mockOpen).not.toHaveBeenCalled(); expect(mockDialog).toHaveBeenCalled();
  });

  it('invalidates the print snapshot after a failed apply', async () => {
    api.get.mockRejectedValueOnce(new Error('Denied'));
    await act(async () => { await button(mockT('operationsReports.apply')).props.onClick() });
    expect(button(mockT('common.print')).props.disabled).toBe(true);
    await act(async () => { await button(mockT('common.print')).props.onClick() });
    expect(mockOpen).not.toHaveBeenCalled();
  });
});
