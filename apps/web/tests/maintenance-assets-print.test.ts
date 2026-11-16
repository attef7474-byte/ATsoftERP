import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { maintenanceAssetsPrintModel, type AssetsPrintData } from '../src/components/print/maintenance-assets-print';
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


const Page=require('../src/app/admin/reports/assets/page').default,api=require('../src/lib/api').api;
const fixture=():AssetsPrintData=>({rows:[{id:'private-asset',code:'M-001',name:'Machine A',category:{name:'Motors'},location:'Zone A',status:'ACTIVE',createdAt:'2026-11-01'}],total:1,page:1,pageSize:20,totalPages:1,cards:[{label:'totalMachines',value:1}],byStatus:[{status:'ACTIVE',count:1}]});
describe('asset business register',()=>{
  it.each(['ar','en'] as const)('renders %s six reviewed columns and canonical status distribution',locale=>{
    mockLocale=locale;const model=maintenanceAssetsPrintModel({data:fixture(),params:{search:'Machine',status:'ACTIVE'},labels:{},scopeKey:'scope'},mockT,locale);
    const html=renderToStaticMarkup(React.createElement(PrintDocument,{model:{...model,locale,company:'Company A',printedAt:new Date(),timeZone:'Asia/Aden'},t:mockT}));
    expect(model.mode).toBe('REGISTER');expect(model.sections).toHaveLength(2);expect(model.sections[0].columns).toHaveLength(6);expect(html).toContain('Motors');expect(html).toContain('M-001');expect(html).toContain('Zone A');expect(html).not.toMatch(/private-asset|<button|<input|Invalid Date|NaN/);
  });
});
describe('actual assets page print integration',()=>{
  let tree:any;const action=()=>mockActions.find(item=>item.id==='print');
  beforeEach(async()=>{jest.clearAllMocks();mockLocale='en';api.get.mockImplementation(async(_route:string,options:any)=>({...fixture(),pageSize:options.params.pageSize}));await act(async()=>{tree=create(React.createElement(Page))})});
  afterEach(()=>act(()=>tree.unmount()));
  it('uses applied search and status in its canonical all-results request',async()=>{
    await act(async()=>{tree.root.findByType('input').props.onChange({target:{value:'Motor'}});tree.root.findByType('select').props.onChange({target:{value:'ACTIVE'}})});
    await act(async()=>{await action().onClick()});expect(api.get.mock.calls.at(-1)).toEqual(['/reports/assets',{params:{search:'Motor',status:'ACTIVE',page:1,pageSize:100}}]);expect(mockOpen.mock.calls[0][0].filters[0].value).toBe('Motor');
  });
  it('shares the prepared document with PDF and aborts a failed collection',async()=>{
    const pdf=tree.root.findAllByType('button').find((button:any)=>button.props['data-pdf']);await act(async()=>{await pdf.props.onClick()});expect(mockOpen).toHaveBeenCalledTimes(1);mockOpen.mockClear();api.get.mockRejectedValueOnce(new Error('Denied'));
    await act(async()=>{await action().onClick()});expect(mockOpen).not.toHaveBeenCalled();expect(mockDialog).toHaveBeenCalled();
  });
});
