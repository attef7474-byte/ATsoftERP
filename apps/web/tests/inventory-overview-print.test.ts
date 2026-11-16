import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { inventoryOverviewPrintModel, type InventoryOverviewPrintData } from '../src/components/print/inventory-overview-print';
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
const Page = require('../src/app/admin/reports/inventory/page').default;
const api = require('../src/lib/api').api;


const fixture=():InventoryOverviewPrintData=>({totalWarehouses:2,totalLocations:3,positiveBalanceProducts:1,zeroBalanceProducts:2,negativeBalanceProducts:0,openCounts:1,completedCounts:2,postedMovements:3,postedAdjustments:4,balancesByWarehouse:[{warehouseId:'private-wh',totalQuantity:123456789,count:3},{warehouseId:'private-missing',totalQuantity:987654321,count:1}],recentCounts:[{id:'private-count',countNumber:'IC-001',warehouse:{id:'private-wh',name:'Raw warehouse'},status:'COMPLETED',createdAt:'2026-11-12'}],recentMovements:[],recentAdjustments:[]});
describe('inventory overview business print',()=>{
 it.each(['ar','en'] as const)('renders %s row counts and existing names without mixed-unit sums or IDs',locale=>{
  mockLocale=locale;const model=inventoryOverviewPrintModel({data:fixture(),params:{},labels:{},scopeKey:'scope'},mockT,locale);
  const html=renderToStaticMarkup(React.createElement(PrintDocument,{model:{...model,locale,company:'Company A',printedAt:new Date(),timeZone:'Asia/Aden'},t:mockT}));
  expect(model.sections).toHaveLength(4);expect(model.sections[0].columns.map(column=>column.key)).toEqual(['warehouse','count']);expect(html).toContain('IC-001');expect(html).toContain('Raw warehouse');expect(html).toContain(mockT('reports.printDocument.inventoryMixedUnits'));expect(html).toContain(mockT('reports.printDocument.missingWarehouseNames'));expect(html).not.toMatch(/private-|123456789|987654321|<button|<input|<nav|NaN|Invalid Date/);
 });
  it.each(['ar','en'] as const)('renders the %s empty state when no inventory rows exist',locale=>{
   mockLocale=locale;const empty:InventoryOverviewPrintData={totalWarehouses:0,totalLocations:0,positiveBalanceProducts:0,zeroBalanceProducts:0,negativeBalanceProducts:0,openCounts:0,completedCounts:0,postedMovements:0,postedAdjustments:0,balancesByWarehouse:[],recentCounts:[],recentMovements:[],recentAdjustments:[]};
   const model=inventoryOverviewPrintModel({data:empty,params:{},labels:{},scopeKey:'scope'},mockT,locale);
   const html=renderToStaticMarkup(React.createElement(PrintDocument,{model:{...model,locale,company:'Company A',printedAt:new Date(),timeZone:'Asia/Aden'},t:mockT}));
   expect(html).toContain(mockT('reports.printDocument.empty'));expect(html).not.toMatch(/NaN|Invalid Date|<button|<input|<nav/);
  });
  it('omits global catalog counters and bounds the complete document before mounting',()=>{
  const data=fixture(),model=inventoryOverviewPrintModel({data,params:{},labels:{},scopeKey:'scope'},mockT,'en');expect(model.summary?.map(field=>field.label)).not.toContain(mockT('reports.totalProducts'));
  data.balancesByWarehouse=Array.from({length:501},()=>data.balancesByWarehouse[0]);expect(()=>inventoryOverviewPrintModel({data,params:{},labels:{},scopeKey:'scope'},mockT,'en')).toThrow('limitExceeded');
 });
});
describe('actual inventory overview page',()=>{
 let tree:any;const action=()=>mockActions.find(item=>item.id==='print');
 beforeEach(async()=>{jest.clearAllMocks();mockLocale='en';api.get.mockResolvedValue(fixture());await act(async()=>{tree=create(React.createElement(Page))})});afterEach(()=>act(()=>tree.unmount()));
 it('prints only the successful canonical screen snapshot without another report read',async()=>{await act(async()=>{await action().onClick()});expect(api.get).toHaveBeenCalledTimes(1);expect(api.get.mock.calls[0][0]).toBe('/reports/inventory/overview');expect(mockOpen.mock.calls[0][0].company).toBe('Company A');expect(mockOpen.mock.calls[0][0].title).toBe(mockT('reports.inventoryOverview'))});
 it('prevents printing stale data after an unsuccessful refresh',async()=>{api.get.mockRejectedValueOnce(new Error('Denied'));await act(async()=>{await mockActions.find(item=>item.id==='refresh').onClick()});expect(action().enabled).toBe(false);await act(async()=>{await action().onClick()});expect(mockOpen).not.toHaveBeenCalled();expect(mockDialog).toHaveBeenCalled()});
});
