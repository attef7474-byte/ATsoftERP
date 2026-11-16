import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { maintenanceSchedulesPrintModel, type SchedulesPrintData } from '../src/components/print/maintenance-schedules-print';
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

const Page=require('../src/app/admin/reports/maintenance/schedules/page').default,api=require('../src/lib/api').api;
const row=(id='private-schedule')=>({id,title:'Motor inspection',machine:{name:'Machine A'},type:'PREVENTIVE',frequency:'MONTHLY',startDate:'2026-11-01',endDate:null,status:'ACTIVE'});
const fixture=():SchedulesPrintData=>({rows:[row()],total:1,page:1,pageSize:20,totalPages:1,cards:[{label:'totalSchedules',value:1},{label:'overdueSchedules',value:0}]});
describe('preventive schedule business print model',()=>{
  it.each(['ar','en'] as const)('renders %s localized frequency, status and optional end dates',locale=>{
    mockLocale=locale;const model=maintenanceSchedulesPrintModel({data:fixture(),params:{dueStatus:'notDue'},labels:{},scopeKey:'scope'},mockT,locale);
    const html=renderToStaticMarkup(React.createElement(PrintDocument,{model:{...model,locale,company:'Company A',printedAt:new Date(),timeZone:'Asia/Aden'},t:mockT}));
    expect(model.sections[0].columns).toHaveLength(7);expect(html).toContain(mockT('status.MONTHLY'));expect(html).toContain(mockT('reports.notDue'));expect(html).toContain('01/11/2026');expect(html).toContain('—');expect(html).not.toMatch(/private-schedule|<button|<input|Invalid Date|NaN|PREVENTIVE/);
  });
  it('rejects an unknown due status or a missing readable machine name',()=>{
    for(const params of [{dueStatus:'unsupported'},{machineId:'private-id'}])expect(()=>maintenanceSchedulesPrintModel({data:fixture(),params,labels:{},scopeKey:'scope'},mockT,'en')).toThrow('unavailable');
  });
});
describe('actual schedule page all-results print integration',()=>{
  let tree:any;const action=()=>mockActions.find(item=>item.id==='print');
  beforeEach(async()=>{jest.clearAllMocks();mockLocale='en';api.get.mockImplementation(async(_route:string,options:any)=>({...fixture(),pageSize:options.params.pageSize}));await act(async()=>{tree=create(React.createElement(Page))})});
  afterEach(()=>act(()=>tree.unmount()));
  it('preserves applied due status in bounded collection and uses the PDF handler',async()=>{
    await act(async()=>{tree.root.findByType('select').props.onChange({target:{value:'overdue'}})});
    const pdf=tree.root.findAllByType('button').find((button:any)=>button.props['data-pdf']);await act(async()=>{await pdf.props.onClick()});
    expect(api.get.mock.calls.at(-1)[1].params).toMatchObject({dueStatus:'overdue',page:1,pageSize:100});expect(mockOpen.mock.calls[0][0].filters[0].value).toBe(mockT('reports.overdue'));
  });
  it('does not replace a newer successful filter snapshot with a late response',async()=>{
    let finish:any;api.get.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));
    await act(async()=>{mockActions.find(item=>item.id==='refresh').onClick()});
    await act(async()=>{tree.root.findByType('select').props.onChange({target:{value:'dueSoon'}})});
    await act(async()=>{finish({...fixture(),rows:[{...row(),title:'STALE'}]})});
    await act(async()=>{await action().onClick()});expect(mockOpen.mock.calls[0][0].filters[0].value).toBe(mockT('reports.dueSoon'));expect(mockOpen.mock.calls[0][0].sections[0].rows[0].title).not.toBe('STALE');
  });
  it('rejects changed totals before printing',async()=>{
    api.get.mockResolvedValueOnce({...fixture(),rows:Array.from({length:100},(_,i)=>row(String(i))),total:101,totalPages:2,pageSize:100}).mockResolvedValueOnce({...fixture(),total:102,totalPages:2,page:2,pageSize:100});
    await act(async()=>{await action().onClick()});expect(mockOpen).not.toHaveBeenCalled();expect(mockDialog).toHaveBeenCalled();
  });
});
