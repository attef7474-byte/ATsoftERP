import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { maintenanceMachineLogPrintModel, type MachineLogPrintData } from '../src/components/print/maintenance-machine-log-print';
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
jest.mock('../src/components/admin/ui', () => ({ Select: (props: any) => React.createElement('select', props), LocalizedValue: () => null, Input: (props: any) => React.createElement('input', props), Button: ({ children, ...props }: any) => React.createElement('button', props, children), DataTable: () => null, Pagination: () => null }));
jest.mock('../src/components/reports', () => ({ ReportPageShell: ({ children, filters }: any) => React.createElement('section', null, filters, children), ReportSummaryCards: () => null, ReportExportButton: (props: any) => React.createElement('button', { onClick: props.onPrint, 'data-pdf': true, disabled: props.printDisabled }) }));
jest.mock('../src/lib/api', () => ({ api: { get: jest.fn() } }));


const Page=require('../src/app/admin/reports/machine-log/page').default,api=require('../src/lib/api').api;
const fixture=():MachineLogPrintData=>({rows:[{id:'private-request',requestNumber:'MR-001',title:'Motor inspection',machine:{name:'Machine A'},type:'PREVENTIVE',status:'OPEN',createdAt:'2026-11-01'}],total:1,page:1,pageSize:20,totalPages:1});
describe('machine log business document',()=>{
  it.each(['ar','en'] as const)('renders %s six reviewed columns and canonical request count',locale=>{
    mockLocale=locale;const model=maintenanceMachineLogPrintModel({data:fixture(),params:{dateFrom:'2026-11-01'},labels:{},scopeKey:'scope'},mockT,locale);
    const html=renderToStaticMarkup(React.createElement(PrintDocument,{model:{...model,locale,company:'Company A',printedAt:new Date(),timeZone:'Asia/Aden'},t:mockT}));
    expect(model.sections[0].columns.map(column=>column.key)).toEqual(['requestNumber','title','machine','type','status','createdAt']);expect(model.summary?.[0].value).toBe('1');expect(html).toContain('MR-001');expect(html).not.toMatch(/private-request|<button|<input|Invalid Date|NaN/);
  });
});
describe('actual machine-log page',()=>{
  let tree:any;const action=()=>mockActions.find(item=>item.id==='print');
  beforeEach(async()=>{jest.clearAllMocks();mockLocale='en';api.get.mockImplementation(async(_route:string,options:any)=>({...fixture(),pageSize:options.params.pageSize}));await act(async()=>{tree=create(React.createElement(Page))})});
  afterEach(()=>act(()=>tree.unmount()));
  it('captures the readable machine and date and shares PDF preparation',async()=>{
    const lookup=tree.root.findAllByType('input').find((input:any)=>input.props.type==='lookup');await act(async()=>{lookup.props.onChange('private-machine');lookup.props.onItemSelect({name:'Machine A'})});
    const pdf=tree.root.findAllByType('button').find((button:any)=>button.props['data-pdf']);await act(async()=>{await pdf.props.onClick()});expect(api.get.mock.calls.at(-1)[1].params).toMatchObject({machineId:'private-machine',pageSize:100});expect(mockOpen.mock.calls[0][0].filters[0].value).toBe('Machine A');
  });
  it('aborts on a denied collection without opening paper',async()=>{
    api.get.mockRejectedValueOnce(new Error('Denied'));await act(async()=>{await action().onClick()});expect(mockOpen).not.toHaveBeenCalled();expect(mockDialog).toHaveBeenCalled();
  });
});
