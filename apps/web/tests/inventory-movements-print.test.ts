import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { inventoryMovementsPrintModel, type MovementsPrintData } from '../src/components/print/inventory-movements-print';
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
jest.mock('../src/components/f9', () => ({ F9Lookup: (props: any) => React.createElement('input', { ...props, type: 'lookup' }), warehouseAdapter: {}, productAdapter: {} }));
jest.mock('../src/components/admin/ui', () => ({ Select: (props: any) => React.createElement('select', props), LocalizedValue: () => null, Input: (props: any) => React.createElement('input', props), Button: ({ children, ...props }: any) => React.createElement('button', props, children), DataTable: () => null, Pagination: () => null }));
jest.mock('../src/components/reports', () => ({ ReportPageShell: ({ children, filters }: any) => React.createElement('section', null, filters, children), ReportSummaryCards: () => null, ReportExportButton: (props: any) => React.createElement('button', { onClick: props.onPrint, 'data-pdf': true, disabled: props.printDisabled }) }));
jest.mock('../src/lib/api', () => ({ api: { get: jest.fn() } }));



const Page=require('../src/app/admin/reports/inventory/movements/page').default,api=require('../src/lib/api').api;
const fixture=():MovementsPrintData=>({rows:[{id:'private-movement',movementNumber:'IM-001',movementDate:'2026-11-12',movementType:'OPENING_BALANCE',warehouse:{name:'Warehouse A'},status:'POSTED',notes:'Opening receipt'}],total:1,page:1,pageSize:20,totalPages:1});
describe('movements reviewed inventory print',()=>{
 it('marks the legacy ignored status filter and excludes source and user IDs',()=>{
  mockLocale='ar';const data=fixture();Object.assign(data.rows[0],{sourceId:'private-source',createdById:'private-user'});
  const model=inventoryMovementsPrintModel({data,params:{countStatus:'DRAFT'},labels:{},scopeKey:'scope'},mockT,'ar');
  expect(model.filters?.[0].value).toContain(mockT('reports.printDocument.notApplied'));
  expect(model.notes).toContain(mockT('reports.printDocument.inventoryStatusNotApplied'));
  expect(model.sections[0].columns.map(column=>column.value(data.rows[0]))).not.toEqual(expect.arrayContaining(['private-source','private-user']));
 });
 it.each(['ar','en'] as const)('renders %s explicit columns and canonical count without unsupported stock totals',locale=>{
  mockLocale=locale;const model=inventoryMovementsPrintModel({data:fixture(),params:{},labels:{},scopeKey:'scope'},mockT,locale);
  const html=renderToStaticMarkup(React.createElement(PrintDocument,{model:{...model,locale,company:'Company A',printedAt:new Date(),timeZone:'Asia/Aden'},t:mockT}));
  expect(model.sections[0].columns.map(column=>column.key)).toEqual(["movementNumber","movementDate","movementType","warehouse","status","notes"]);expect(model.summary?.[0].value).toBe('1');expect(html).toContain('IM-001');expect(html).toContain(mockT('reports.printDocument.movementHeadersOnly'));expect(html).not.toMatch(/private-|<button|<input|Invalid Date|NaN|lockVersion/);expect(model.summary).toHaveLength(1);
 });
  it.each(['ar','en'] as const)('renders the %s empty state when no movements exist',locale=>{
   mockLocale=locale;const empty:MovementsPrintData={rows:[],total:0,page:1,pageSize:20,totalPages:0};
   const model=inventoryMovementsPrintModel({data:empty,params:{},labels:{},scopeKey:'scope'},mockT,locale);
   const html=renderToStaticMarkup(React.createElement(PrintDocument,{model:{...model,locale,company:'Company A',printedAt:new Date(),timeZone:'Asia/Aden'},t:mockT}));
   expect(html).toContain(mockT('reports.printDocument.empty'));expect(html).not.toMatch(/NaN|Invalid Date|<button|<input/);
  });
  it('requires readable warehouse labels instead of printing internal filter IDs',()=>{expect(()=>inventoryMovementsPrintModel({data:fixture(),params:{warehouseId:'private-warehouse'},labels:{},scopeKey:'scope'},mockT,'en')).toThrow('unavailable')});
});
describe('actual movements page through shared engine',()=>{
 let tree:any;const action=()=>mockActions.find(item=>item.id==='print');
 beforeEach(async()=>{jest.clearAllMocks();mockLocale='en';api.get.mockImplementation(async(_route:string,options:any)=>({...fixture(),pageSize:options.params.pageSize}));await act(async()=>{tree=create(React.createElement(Page))})});afterEach(()=>act(()=>tree.unmount()));
 it('uses readable applied warehouse and shares PDF preparation with bounded canonical collection',async()=>{
  const lookup=tree.root.findAllByType('input').find((input:any)=>input.props.type==='lookup');await act(async()=>{lookup.props.onChange('private-warehouse');lookup.props.onItemSelect({name:'Warehouse A'})});
  const pdf=tree.root.findAllByType('button').find((button:any)=>button.props['data-pdf']);await act(async()=>{await pdf.props.onClick()});expect(api.get.mock.calls.at(-1)[0]).toBe('/reports/inventory/movements');expect(api.get.mock.calls.at(-1)[1].params).toMatchObject({warehouseId:'private-warehouse',pageSize:100});expect(mockOpen.mock.calls[0][0].filters[0].value).toBe('Warehouse A');expect(mockOpen.mock.calls[0][0].company).toBe('Company A');
 });
 it('opens no document if a later collection page is denied',async()=>{
  api.get.mockImplementation(async(_route:string,options:any)=>{if(options.params.page===2)throw new Error('Denied');return {...fixture(),total:101,totalPages:2,pageSize:100,rows:Array.from({length:100},(_,i)=>({...fixture().rows[0],id:'row-'+i}))}});await act(async()=>{await action().onClick()});expect(mockOpen).not.toHaveBeenCalled();expect(mockDialog).toHaveBeenCalled();expect(api.get.mock.calls.at(-1)[1].params.page).toBe(2);
 });
 it('invalidates the print snapshot after failed refresh',async()=>{api.get.mockRejectedValueOnce(new Error('Denied'));await act(async()=>{await mockActions.find(item=>item.id==='refresh').onClick()});expect(action().enabled).toBe(false);await act(async()=>{await action().onClick()});expect(mockOpen).not.toHaveBeenCalled()});
});
