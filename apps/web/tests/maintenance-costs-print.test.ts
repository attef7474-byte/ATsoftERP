import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { maintenanceCostsPrintModel, type MaintenanceCostsPrintData } from '../src/components/print/maintenance-costs-print';
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
jest.mock('../src/components/f9', () => ({ F9Lookup: (props: any) => React.createElement('input', { ...props, type: 'lookup' }), productionLineAdapter: {}, machineAdapter: {}, operationTypeAdapter: {}, costCenterAdapter: {}, machineComponentAdapter: {}, sparePartAdapter: {} }));
jest.mock('../src/components/admin/ui', () => ({ Input: (props: any) => React.createElement('input', props), Button: ({ children, ...props }: any) => React.createElement('button', props, children), DataTable: () => null, Pagination: () => null }));
jest.mock('../src/components/reports', () => ({ ReportPageShell: ({ children, filters }: any) => React.createElement('section', null, filters, children), ReportSummaryCards: () => null, ReportExportButton: (props: any) => React.createElement('button', { onClick: props.onPrint, 'data-pdf': true, disabled: props.printDisabled }) }));
jest.mock('../src/lib/api', () => ({ api: { get: jest.fn() } }));

const Page = require('../src/app/admin/reports/maintenance/costs/page').default, api = require('../src/lib/api').api;
const fixture = (): MaintenanceCostsPrintData => ({ rows: [
  { id: 'same-id', _type: 'cost', request: { requestNumber: 'MR-001' }, description: 'Repair labour', amount: 0, incurredAt: '2026-11-01' },
  { id: 'same-id', _type: 'part', request: { requestNumber: 'MR-002' }, product: { name: 'Bearing' }, quantity: 2, totalCost: null, createdAt: '2025-01-01' },
], total: 1000, page: 2, pageSize: 20, totalPages: 50, cards: [{ label: 'totalCost', value: 1234.5 }, { label: 'partsUsage', value: 100 }] });
const snapshot = (data=fixture()) => ({ data, params: { page: 2, pageSize: 20, dateFrom: '2026-11-01' }, labels: {}, scopeKey: 'scope' });

describe('costs current-page extract business policy', () => {
  it('accepts the canonical API numeric pagination strings', () => {
    const data = fixture(); (data as any).page = '2'; (data as any).pageSize = '20';
    expect(maintenanceCostsPrintModel(snapshot(data), mockT, 'en').metadata?.[0].value).toBe('2');
  });
  it.each(['ar', 'en'] as const)('renders %s separate streams, global totals, zero/null and actual part recording date', locale => {
    mockLocale=locale;const model=maintenanceCostsPrintModel(snapshot(),mockT,locale);
    const html=renderToStaticMarkup(React.createElement(PrintDocument,{model:{...model,locale,company:'Company A',printedAt:new Date(),timeZone:'Asia/Aden'},t:mockT}));
    expect(model.scopeLabel).toBe(mockT('reports.printDocument.costsPageScope'));expect(model.sections.map(section=>section.rows.length)).toEqual([1,1,2]);
    expect(model.sections[2].rows[0].value).toBe(1234.5);expect(html).toContain('1,234.50');expect(html).toContain('0.00');expect(html).toContain('—');expect(html).toContain('01/01/2025');
    expect(html).toContain(mockT('reports.printDocument.costsFilterNote'));expect(html).not.toMatch(/same-id|<button|<input|Invalid Date|NaN/);
  });
  it.each(['wrong page','duplicate','unknown stream','too many parts'])('rejects malformed composite data: %s', mode=>{
    const data=fixture();if(mode==='wrong page')data.page=3;else if(mode==='duplicate')data.rows.push(data.rows[0]);else if(mode==='unknown stream')(data.rows[0] as any)._type='unsupported';else data.rows=Array.from({length:11},(_,i)=>({...data.rows[1],id:String(i)}));
    expect(()=>maintenanceCostsPrintModel(snapshot(data),mockT,'en')).toThrow('dataChanged');
  });
  it('requires a readable filter label rather than exposing an ID',()=>{
    expect(()=>maintenanceCostsPrintModel({...snapshot(),params:{page:2,machineId:'private-machine'}},mockT,'en')).toThrow('unavailable');
  });
});

describe('actual costs page prints only its successful current-page snapshot',()=>{
  let tree:any;
  beforeEach(async()=>{jest.clearAllMocks();mockLocale='en';api.get.mockImplementation(async(_route:string,options:any)=>({...fixture(),page:options.params.page}));await act(async()=>{tree=create(React.createElement(Page))})});
  afterEach(()=>act(()=>tree.unmount()));
  const action=()=>mockActions.find(item=>item.id==='print');
  it('makes no extra collection requests and cannot imply the 1000 matching records are printed',async()=>{
    expect(api.get).toHaveBeenCalledTimes(1);await act(async()=>{await action().onClick()});expect(api.get).toHaveBeenCalledTimes(1);
    const model=mockOpen.mock.calls[0][0];expect(model.sections[0].rows).toHaveLength(1);expect(model.scopeLabel).toContain('PARTIAL');expect(model.metadata[1].value).toBe('2');
  });
  it('shares the document with PDF and disables both after a failed refresh',async()=>{
    const pdf=tree.root.findAllByType('button').find((button:any)=>button.props['data-pdf']);await act(async()=>{await pdf.props.onClick()});expect(mockOpen).toHaveBeenCalledTimes(1);mockOpen.mockClear();
    api.get.mockRejectedValueOnce(new Error('Denied'));await act(async()=>{await mockActions.find(item=>item.id==='refresh').onClick()});expect(action().enabled).toBe(false);await act(async()=>{await action().onClick()});expect(mockOpen).not.toHaveBeenCalled();expect(mockDialog).toHaveBeenCalled();
  });
});
