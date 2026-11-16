import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import {
  inventoryLedgerPrintModel,
  type LedgerRegisterPrintData,
} from '../src/components/print/inventory-ledger-register-print';
import {
  inventoryMovementsPrintModel,
  type MovementsPrintData,
} from '../src/components/print/inventory-movements-print';
import { buildMovementRegisterPrint } from '../src/components/print/inventory-movement-register-print';
import { normalizeLedgerPrintPage } from '../src/app/admin/inventory/ledger/filter-contract';
import { collectPrintRows, PrintPreparationError, printFormatters } from '../src/lib/print';
import { PrintDocument } from '../src/components/print/PrintDocument';
const { act, create } = require('react-test-renderer');

let mockLocale: 'ar' | 'en' = 'en';
let mockActions: any[] = [];
let mockContext: any = {
  companyId: 'company-a',
  branchId: 'branch-a',
  companyName: 'Company A',
  branchName: 'Branch A',
};
const mockT = (key: string): string => {
  const value = key.split('.').reduce<any>((node, part) => node?.[part], mockLocale === 'ar' ? ar : en);
  if (typeof value !== 'string') throw new Error(`Missing ${key}`);
  return value;
};
const mockOpen = jest.fn(async (..._args: any[]) => {});
const mockDialog = jest.fn();

jest.mock('../src/lib/i18n/use-translation', () => ({
  useTranslation: () => ({ t: mockT, locale: mockLocale, dir: mockLocale === 'ar' ? 'rtl' : 'ltr' }),
}));
jest.mock('../src/lib/auth-context', () => ({
  useAuth: () => ({ activeContext: mockContext, contextVersion: 1, contextLoading: false, user: { id: 'reviewer', name: 'Reviewer' } }),
}));
jest.mock('../src/components/admin/error-modal', () => ({ useErrorModal: () => ({ showError: mockDialog }) }));
jest.mock('../src/components/print/print-runtime', () => ({ openPrintDocument: (...args: any[]) => mockOpen(...args) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../src/components/admin/toast-provider', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/components/admin/admin-action-bar', () => ({
  useRegisterAdminActions: (actions: any[]) => { mockActions = actions; },
  useStableHandlers: (handlers: any) => ({ exec: (name: string) => handlers[name]() }),
  ActionRefreshIcon: () => null,
  ActionPrintIcon: () => null,
}));
jest.mock('../src/components/f9', () => ({ F9Lookup: (props: any) => React.createElement('input', { ...props, type: 'lookup' }), warehouseAdapter: {}, productAdapter: {} }));
jest.mock('../src/components/admin/ui', () => ({
  Input: (props: any) => React.createElement('input', props),
  Select: (props: any) => React.createElement('select', props),
  Button: ({ children, ...props }: any) => React.createElement('button', props, children),
  PageHeader: (props: any) => React.createElement('h1', null, props.title),
  Card: ({ children }: any) => React.createElement('section', null, children),
  Pagination: () => null,
}));
jest.mock('../src/components/admin/admin-data-grid', () => ({ AdminDataGrid: () => null }));
jest.mock('../src/lib/api', () => ({ api: { get: jest.fn() } }));

const Page = require('../src/app/admin/inventory/ledger/page').default;
const api = require('../src/lib/api').api;

const row = (index: number, overrides: Record<string, unknown> = {}) => ({
  id: `private-movement-${index}`,
  movementNumber: `IM-${String(index).padStart(3, '0')}`,
  movementDate: '2026-11-12',
  movementType: 'ADJUSTMENT_IN',
  warehouse: { code: 'WH-1', name: 'Main Warehouse' },
  status: 'POSTED',
  notes: `Note ${index}`,
  sourceId: `private-source-${index}`,
  createdById: `private-user-${index}`,
  lockVersion: 7,
  ...overrides,
});

const ledgerData = (rows: any[], total = rows.length, page = 1, pageSize = 20): LedgerRegisterPrintData => ({
  rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize),
});

const renderModel = (model: any, locale: 'ar' | 'en') => {
  mockLocale = locale;
  return renderToStaticMarkup(React.createElement(PrintDocument, {
    model: { ...model, locale, company: 'Company A', printedAt: new Date('2026-11-13T09:30:00Z'), timeZone: 'Asia/Aden' },
    t: mockT,
  }));
};

const action = (id: string) => mockActions.find(item => item.id === id);
const applyButton = (tree: any) => tree.root.findAllByType('button').find((button: any) => button.props.children === mockT('actions.apply'));
const inputs = (tree: any): any[] => tree.root.findAllByType('input');
const selects = (tree: any): any[] => tree.root.findAllByType('select');

async function renderLedger() {
  let tree: any;
  await act(async () => { tree = create(React.createElement(Page)); });
  return tree;
}

async function applyAndPrint(tree: any) {
  await act(async () => { await applyButton(tree).props.onClick(); });
  await act(async () => { await action('print').onClick(); });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLocale = 'en';
  mockContext = { companyId: 'company-a', branchId: 'branch-a', companyName: 'Company A', branchName: 'Branch A' };
  api.get.mockImplementation(async (route: string, options: any = {}) => {
    if (route !== '/inventory/ledger/movements') throw new Error(`Unexpected route ${route}`);
    const params = options.params || {};
    const page = params.page || 1;
    const limit = params.limit || 20;
    const rows = [row(1)];
    return { data: rows, meta: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit) } };
  });
});

describe('shared InventoryMovement register model', () => {
  it('ILR-P01/P02 renders the Arabic (RTL) and English (LTR) Ledger register', () => {
    for (const locale of ['ar', 'en'] as const) {
      mockLocale = locale;
      const model = inventoryLedgerPrintModel({ data: ledgerData([row(1)]), params: {}, labels: {}, scopeKey: 'scope' }, mockT, locale);
      const html = renderModel(model, locale);
      expect(model.mode).toBe('REGISTER');
      expect(model.title).toBe(mockT('inventoryLedger.title'));
      expect(html).toContain(`dir="${locale === 'ar' ? 'rtl' : 'ltr'}"`);
      expect(html).toContain('IM-001');
      expect(html).toContain('Main Warehouse');
      expect(html).toContain(mockT('inventoryLedger.title'));
    }
  });

  it('ILR-P03 keeps the Ledger title while sharing the exact Movements business rows/columns', () => {
    mockLocale = 'en';
    const data = ledgerData([row(1)]);
    const ledger = inventoryLedgerPrintModel({ data, params: {}, labels: {}, scopeKey: 'scope' }, mockT, 'en');
    const movements = inventoryMovementsPrintModel({ data: data as MovementsPrintData, params: {}, labels: {}, scopeKey: 'scope' }, mockT, 'en');
    expect(ledger.title).toBe(mockT('inventoryLedger.title'));
    expect(movements.title).toBe(mockT('reports.movementsReport'));
    expect(ledger.title).not.toBe(movements.title);
    expect(ledger.sections[0].rows).toEqual(movements.sections[0].rows);
    expect(ledger.sections[0].columns.map(column => column.key)).toEqual(movements.sections[0].columns.map(column => column.key));
    expect(ledger.summary).toEqual(movements.summary);
    expect(ledger.mode).toBe(movements.mode);
    expect(ledger.orientation).toBe(movements.orientation);
    expect(ledger.notes).toEqual(movements.notes);
    expect(ledger.scopeLabel).toBe(movements.scopeLabel);
  });

  it('ILR-P04/P05/P06/P07/P08/P09 preserves the canonical six columns and readable business values', () => {
    mockLocale = 'en';
    const model = inventoryLedgerPrintModel({ data: ledgerData([row(1, { movementType: 'OPENING_BALANCE', status: 'DRAFT', notes: 'Opening receipt' })]), params: {}, labels: {}, scopeKey: 'scope' }, mockT, 'en');
    const columns = model.sections[0].columns;
    expect(columns.map(column => column.key)).toEqual(['movementNumber', 'movementDate', 'movementType', 'warehouse', 'status', 'notes']);
    const entry = row(1, { movementType: 'OPENING_BALANCE', status: 'DRAFT', notes: 'Opening receipt' });
    expect(columns[0].value(entry)).toBe('IM-001');
    expect(columns[2].value(entry)).not.toBe('OPENING_BALANCE');
    expect(columns[3].value(entry)).toBe('Main Warehouse');
    expect(columns[4].value(entry)).not.toBe('DRAFT');
    expect(columns[5].value(entry)).toBe('Opening receipt');
    const html = renderModel(model, 'en');
    expect(html).not.toMatch(/OPENING_BALANCE|>DRAFT</);
  });

  it('ILR-P10/P11/P12/P13/P14 exposes only a movement count summary and no product/quantity/UOM/balance/valuation output', () => {
    mockLocale = 'en';
    const entry = row(1, { lines: [{ productId: 'private-product', quantity: 5, unit: 'KG' }], totalCost: 250, runningBalance: 99 });
    const model = inventoryLedgerPrintModel({ data: ledgerData([entry]), params: {}, labels: {}, scopeKey: 'scope' }, mockT, 'en');
    expect(model.summary).toHaveLength(1);
    expect(model.summary?.[0].label).toBe(mockT('reports.totalMovements'));
    expect(model.sections[0].columns).toHaveLength(6);
    expect(model.sections[0].totals).toBeUndefined();
    const html = renderModel(model, 'en');
    expect(html).not.toMatch(/Running Balance|Opening Balance|Closing Balance|Unit Cost|Total Cost|Value|250/);
    expect(html).not.toContain('private-product');
    expect(model.notes).toContain(mockT('reports.printDocument.inventoryMixedUnits'));
  });

  it('ILR-P15/P16 redacts technical ids, sourceId and secrets from the register document', () => {
    const entry = row(1, {
      sourceId: 'private-source', createdById: 'private-user', postedById: 'private-poster', companyId: 'private-company',
      branchId: 'private-branch', warehouseId: 'private-warehouse', locationId: 'private-location', requestId: 'private-request',
      token: 'private-token', _count: { lines: 1 },
    });
    for (const locale of ['ar', 'en'] as const) {
      const model = inventoryLedgerPrintModel({ data: ledgerData([entry]), params: {}, labels: {}, scopeKey: 'scope' }, mockT, locale);
      const html = renderModel(model, locale);
      expect(html).not.toMatch(/private-|_count|lockVersion|Bearer|token/i);
    }
  });

  it('ILR-P17 prints human-readable applied filter metadata and never a raw filter id', () => {
    mockLocale = 'ar';
    const model = inventoryLedgerPrintModel({
      data: ledgerData([row(1)]),
      params: {
        search: 'IM-001', warehouseId: 'private-warehouse', productId: 'private-product',
        movementType: 'OPENING_BALANCE', status: 'POSTED', direction: 'IN',
        sourceType: 'MANUAL', dateFrom: '2026-11-01', dateTo: '2026-11-12',
      },
      labels: { warehouseId: 'Main Warehouse', productId: 'Steel Plate' },
      scopeKey: 'scope',
    }, mockT, 'ar');
    const values = (model.filters || []).map(field => field.value);
    expect(values).toEqual(expect.arrayContaining([
      'IM-001',
      'Main Warehouse',
      'Steel Plate',
      printFormatters('ar').dateOnly('2026-11-01'),
      printFormatters('ar').dateOnly('2026-11-12'),
    ]));
    expect(values).not.toEqual(expect.arrayContaining(['private-warehouse', 'private-product']));
    expect(model.periodStart).toBe('2026-11-01');
    expect(model.periodEnd).toBe('2026-11-12');
    const html = renderModel(model, 'ar');
    expect(html).not.toMatch(/private-warehouse|private-product/);
    expect(html).not.toMatch(/NaN|Invalid Date/);
  });

  it('ILR-P18/P19 metadata requires readable warehouse/product labels instead of raw ids', () => {
    expect(() => inventoryLedgerPrintModel({ data: ledgerData([]), params: { warehouseId: 'private-warehouse' }, labels: {}, scopeKey: 'scope' }, mockT, 'en')).toThrow('unavailable');
    expect(() => inventoryLedgerPrintModel({ data: ledgerData([]), params: { productId: 'private-product' }, labels: {}, scopeKey: 'scope' }, mockT, 'en')).toThrow('unavailable');
  });

  it('ILR-P31/P32 produces a runtime REGISTER document whose print and PDF representation share one model', () => {
    mockLocale = 'en';
    const model = inventoryLedgerPrintModel({ data: ledgerData([row(1)]), params: {}, labels: {}, scopeKey: 'scope' }, mockT, 'en');
    const html = renderModel(model, 'en');
    expect(html).toContain('data-mode="REGISTER"');
    expect(html).toContain(mockT('inventoryLedger.title'));
    expect(html).toContain('IM-001');
    expect(model.notes).toHaveLength(2);
    expect(model.paperSize).toBe('A4');
    expect(model.orientation).toBe('portrait');
  });

  it('ILR-P33 keeps the accepted Movements Register output identical after shared extraction', () => {
    mockLocale = 'en';
    const data: MovementsPrintData = ledgerData([row(1)] as any);
    const model = inventoryMovementsPrintModel({ data, params: { warehouseId: 'private-warehouse', dateFrom: '2026-11-01' }, labels: { warehouseId: 'Main Warehouse' }, scopeKey: 'scope' }, mockT, 'en');
    expect(model.mode).toBe('REGISTER');
    expect(model.title).toBe(mockT('reports.movementsReport'));
    expect(model.scopeLabel).toBe(mockT('reports.printDocument.allFiltered'));
    expect(model.filters).toEqual([{ label: mockT('reports.warehouse'), value: 'Main Warehouse' }]);
    expect(model.periodStart).toBe('2026-11-01');
    expect(model.summary).toEqual([{ label: mockT('reports.totalMovements'), value: '1' }]);
    expect(model.sections[0].columns.map((column: any) => column.key)).toEqual(['movementNumber', 'movementDate', 'movementType', 'warehouse', 'status', 'notes']);
    expect(model.notes).toEqual([mockT('reports.printDocument.movementHeadersOnly'), mockT('reports.printDocument.inventoryMixedUnits')]);
    const legacy = inventoryMovementsPrintModel({ data, params: { countStatus: 'DRAFT' }, labels: {}, scopeKey: 'scope' }, mockT, 'en');
    expect(legacy.filters?.[0].value).toContain(mockT('reports.printDocument.notApplied'));
    expect(legacy.notes).toContain(mockT('reports.printDocument.inventoryStatusNotApplied'));
  });

  it('canonical builder refuses no route metadata but keeps columns shared', () => {
    mockLocale = 'en';
    const model = buildMovementRegisterPrint({ data: ledgerData([row(1)]), title: 'Any title' }, mockT, 'en');
    expect(model.title).toBe('Any title');
    expect(model.sections[0].columns.map(column => column.key)).toEqual(['movementNumber', 'movementDate', 'movementType', 'warehouse', 'status', 'notes']);
    expect(model.notes).toHaveLength(2);
  });
});

describe('ledger print flow', () => {
  it('ILR-P18/P19/P20/P21 prints applied status/direction/product filters and never countStatus', async () => {
    const tree = await renderLedger();
    const statusSelect = selects(tree).find(select => select.props.label === mockT('inventoryLedger.status'));
    const directionSelect = selects(tree).find(select => select.props.label === mockT('inventoryLedger.direction'));
    const productLookup = inputs(tree).filter(input => input.props.type === 'lookup')[1];
    await act(async () => {
      statusSelect.props.onChange({ target: { value: 'POSTED' } });
      directionSelect.props.onChange({ target: { value: 'OUT' } });
      productLookup.props.onChange('private-product');
      productLookup.props.onItemSelect({ name: 'Steel Plate' });
    });
    await act(async () => { await applyButton(tree).props.onClick(); });
    const screenCall = api.get.mock.calls.at(-1);
    await act(async () => { await action('print').onClick(); });
    const printCall = api.get.mock.calls.at(-1);
    expect(printCall[0]).toBe('/inventory/ledger/movements');
    expect(printCall[1].params).toMatchObject({ page: 1, limit: 100, status: 'POSTED', direction: 'OUT', productId: 'private-product' });
    expect(printCall[1].params.countStatus).toBeUndefined();
    const strip = (params: any) => { const { page: _page, limit: _limit, pageSize: _pageSize, ...rest } = params; return rest; };
    expect(strip(printCall[1].params)).toEqual(strip(screenCall[1].params));
    expect(mockOpen.mock.calls[0][0].summary).toEqual([{ label: mockT('reports.totalMovements'), value: '1' }]);
    await act(() => tree.unmount());
  });

  it('ILR-P20/P21 keeps one header row when product or direction filters match line facts', async () => {
    api.get.mockImplementation(async (route: string, options: any = {}) => {
      if (route !== '/inventory/ledger/movements') throw new Error(`Unexpected route ${route}`);
      const params = options.params || {};
      expect(params.productId).toBe('private-product');
      expect(params.direction).toBe('OUT');
      return {
        data: [row(1, { lines: [{ productId: 'private-product', direction: 'OUT', quantity: 2, unit: 'KG' }, { productId: 'private-other', direction: 'IN', quantity: 4, unit: 'PCS' }] })],
        meta: { page: params.page || 1, limit: params.limit || 20, total: 1, totalPages: 1 },
      };
    });
    const tree = await renderLedger();
    const directionSelect = selects(tree).find(select => select.props.label === mockT('inventoryLedger.direction'));
    const productLookup = inputs(tree).filter(input => input.props.type === 'lookup')[1];
    await act(async () => {
      directionSelect.props.onChange({ target: { value: 'OUT' } });
      productLookup.props.onChange('private-product');
      productLookup.props.onItemSelect({ name: 'Steel Plate' });
    });
    await applyAndPrint(tree);
    const printed = mockOpen.mock.calls[0][0];
    expect(printed.sections[0].rows).toHaveLength(1);
    expect(printed.sections[0].rows[0].movementNumber).toBe('IM-001');
    expect(printed.sections[0].columns).toHaveLength(6);
    expect(printed.summary).toEqual([{ label: mockT('reports.totalMovements'), value: '1' }]);
    await act(() => tree.unmount());
  });

  it('ILR date-filter parity reuses the applied date-only contract and never countStatus', async () => {
    const tree = await renderLedger();
    const dateFrom = inputs(tree).find(input => input.props.label === mockT('inventoryLedger.dateFrom'));
    const dateTo = inputs(tree).find(input => input.props.label === mockT('inventoryLedger.dateTo'));
    const search = inputs(tree).find(input => input.props.label === mockT('inventoryLedger.search'));
    await act(async () => {
      dateFrom.props.onChange({ target: { value: '2026-11-01' } });
      dateTo.props.onChange({ target: { value: '2026-11-12' } });
      search.props.onChange({ target: { value: 'urgent note' } });
    });
    await act(async () => { await applyButton(tree).props.onClick(); });
    const screenCall = api.get.mock.calls.at(-1);
    await act(async () => { await action('print').onClick(); });
    const printCall = api.get.mock.calls.at(-1);
    const strip = (params: any) => { const { page: _page, limit: _limit, pageSize: _pageSize, ...rest } = params; return rest; };
    expect(strip(printCall[1].params)).toEqual(strip(screenCall[1].params));
    expect(printCall[1].params).toMatchObject({ dateFrom: '2026-11-01', dateTo: '2026-11-12', search: 'urgent note' });
    expect(printCall[1].params.countStatus).toBeUndefined();
    const searchFilter = mockOpen.mock.calls[0][0].filters.find((field: any) => field.label === mockT('inventoryLedger.search'));
    expect(searchFilter.value).toBe('urgent note');
    expect(searchFilter.label).not.toBe(mockT('inventoryLedger.movementNumber'));
    expect(mockT('inventoryLedger.searchPlaceholder')).toMatch(/notes/i);
    await act(() => tree.unmount());
  });

  it('ILR-P18 draft filter edits do not change the printed applied scope', async () => {
    const tree = await renderLedger();
    const statusSelect = selects(tree).find(select => select.props.label === mockT('inventoryLedger.status'));
    await act(async () => { statusSelect.props.onChange({ target: { value: 'CANCELLED' } }); });
    await act(async () => { await action('print').onClick(); });
    expect(api.get.mock.calls.at(-1)[1].params.status).toBeUndefined();
    await act(() => tree.unmount());
  });

  it('ILR-P17 prints readable remembered warehouse/product labels, never ids', async () => {
    const tree = await renderLedger();
    const lookups = inputs(tree).filter(input => input.props.type === 'lookup');
    await act(async () => {
      lookups[0].props.onChange('private-warehouse');
      lookups[0].props.onItemSelect({ code: 'WH-1', name: 'Main Warehouse' });
      lookups[1].props.onChange('private-product');
      lookups[1].props.onItemSelect({ code: 'P-1', name: 'Steel Plate' });
    });
    await applyAndPrint(tree);
    const values = mockOpen.mock.calls[0][0].filters.map((field: any) => field.value);
    expect(values).toEqual(expect.arrayContaining(['Main Warehouse', 'Steel Plate']));
    expect(values).not.toEqual(expect.arrayContaining(['private-warehouse', 'private-product']));
    await act(() => tree.unmount());
  });

  it('ILR-P22/ILR-P23 collects every bounded page and each movement number exactly once', async () => {
    const allRows = Array.from({ length: 250 }, (_, index) => row(index + 1, { movementDate: '2026-11-12' }));
    api.get.mockImplementation(async (route: string, options: any = {}) => {
      if (route !== '/inventory/ledger/movements') throw new Error(`Unexpected route ${route}`);
      const params = options.params || {};
      const page = params.page || 1;
      const limit = params.limit || 20;
      const start = (page - 1) * limit;
      return { data: allRows.slice(start, start + limit), meta: { page, limit, total: allRows.length, totalPages: Math.ceil(allRows.length / limit) } };
    });
    const tree = await renderLedger();
    await act(async () => { await action('print').onClick(); });
    const model = mockOpen.mock.calls[0][0];
    expect(api.get.mock.calls.filter((call: any[]) => call[1]?.params?.limit === 100)).toHaveLength(3);
    expect(model.sections[0].rows).toHaveLength(250);
    const numbers = model.sections[0].rows.map((entry: any) => entry.movementNumber);
    expect(new Set(numbers).size).toBe(250);
    expect(model.summary).toEqual([{ label: mockT('reports.totalMovements'), value: '250' }]);
    await act(() => tree.unmount());
  });

  it('ILR-P24 accepts the 500-row boundary', async () => {
    const allRows = Array.from({ length: 500 }, (_, index) => row(index + 1));
    api.get.mockImplementation(async (_route: string, options: any = {}) => {
      const params = options.params || {};
      const page = params.page || 1;
      const limit = params.limit || 20;
      const start = (page - 1) * limit;
      return { data: allRows.slice(start, start + limit), meta: { page, limit, total: allRows.length, totalPages: Math.ceil(allRows.length / limit) } };
    });
    const tree = await renderLedger();
    await act(async () => { await action('print').onClick(); });
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockOpen.mock.calls[0][0].sections[0].rows).toHaveLength(500);
    await act(() => tree.unmount());
  });

  it('ILR-P25 blocks 501 rows with the localized narrow-filters error and no partial document', async () => {
    api.get.mockImplementation(async (_route: string, options: any = {}) => {
      const params = options.params || {};
      const page = params.page || 1;
      const limit = params.limit || 20;
      return { data: [], meta: { page, limit, total: 501, totalPages: Math.ceil(501 / limit) } };
    });
    const tree = await renderLedger();
    await act(async () => { await action('print').onClick(); });
    expect(mockOpen).not.toHaveBeenCalled();
    expect(mockDialog).toHaveBeenCalledWith(expect.objectContaining({ message: mockT('reports.printDocument.limitExceeded') }));
    await act(() => tree.unmount());
  });

  it('ILR-P28 aborts without a document when a later collection page is denied', async () => {
    api.get.mockImplementation(async (_route: string, options: any = {}) => {
      const params = options.params || {};
      const page = params.page || 1;
      const limit = params.limit || 20;
      if (limit === 100) {
        if (page === 2) throw new Error('Denied');
        return { data: Array.from({ length: 100 }, (_, index) => row(index + 1)), meta: { page, limit, total: 150, totalPages: 2 } };
      }
      return { data: [row(1)], meta: { page, limit, total: 1, totalPages: 1 } };
    });
    const tree = await renderLedger();
    await act(async () => { await action('print').onClick(); });
    expect(api.get.mock.calls.at(-1)[1].params.page).toBe(2);
    expect(mockOpen).not.toHaveBeenCalled();
    expect(mockDialog).toHaveBeenCalled();
    await act(() => tree.unmount());
  });

  it('ILR-P29/P30 uses only inventory-ledger:read and never calls the Reports endpoint', async () => {
    const tree = await renderLedger();
    expect(action('print').permission).toBe('inventory-ledger:read');
    expect(action('print').readOnly).toBe(true);
    await act(async () => { await action('print').onClick(); });
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(api.get.mock.calls.every((call: any[]) => call[0] === '/inventory/ledger/movements')).toBe(true);
    expect(api.get.mock.calls.some((call: any[]) => String(call[0]).includes('/reports/'))).toBe(false);
    const model = mockOpen.mock.calls[0][0];
    expect(model.mode).toBe('REGISTER');
    expect(model.title).toBe(mockT('inventoryLedger.title'));
    expect(model.company).toBe('Company A');
    expect(model.branch).toBe('Branch A');
    expect(model.printedAt).toBeInstanceOf(Date);
    expect(model.printedBy).toBe('Reviewer');
    await act(() => tree.unmount());
  });

  it('invalidates the snapshot after a failed refresh so no stale scope can print', async () => {
    const tree = await renderLedger();
    expect(action('print').enabled).toBe(true);
    api.get.mockRejectedValueOnce(new Error('Denied'));
    await act(async () => { await action('refresh').onClick(); });
    expect(action('print').enabled).toBe(false);
    await act(async () => { await action('print').onClick(); });
    expect(mockOpen).not.toHaveBeenCalled();
    await act(() => tree.unmount());
  });
});

describe('collector safety reused by the ledger register', () => {
  it('ILR-P26 aborts on operational scope change during collection', async () => {
    let checks = 0;
    const assertScope = jest.fn(() => { checks += 1; if (checks === 2) throw new PrintPreparationError('contextChanged'); });
    await expect(collectPrintRows(
      async (page, pageSize) => ({ rows: [row(1)], total: 101, page, pageSize, totalPages: 2 }),
      assertScope,
      entry => entry.id,
    )).rejects.toThrow('contextChanged');
  });

  it('ILR-P27 fails closed on duplicate identities or a changed total', async () => {
    await expect(collectPrintRows(
      async (page, pageSize) => page === 1
        ? { rows: Array.from({ length: 100 }, (_, index) => row(index + 1)), total: 101, page, pageSize, totalPages: 2 }
        : { rows: [row(1)], total: 101, page, pageSize, totalPages: 2 },
      () => undefined,
      entry => entry.id,
    )).rejects.toThrow('dataChanged');
    await expect(collectPrintRows(
      async (page, pageSize) => page === 1
        ? { rows: Array.from({ length: 100 }, (_, index) => row(index + 1)), total: 101, page, pageSize, totalPages: 2 }
        : { rows: [row(101)], total: 102, page, pageSize, totalPages: 2 },
      () => undefined,
      entry => entry.id,
    )).rejects.toThrow('dataChanged');
  });

  it('normalizes the Ledger meta envelope without mutating business rows', () => {
    const rows = [row(1)];
    const payload = { data: rows, meta: { page: 3, limit: 100, total: 250, totalPages: 3 } };
    const normalized = normalizeLedgerPrintPage(payload);
    expect(normalized).toEqual({ rows, total: 250, page: 3, pageSize: 100, totalPages: 3 });
    expect(normalized.rows[0]).toBe(rows[0]);
    expect(normalizeLedgerPrintPage({ data: null, meta: null })).toEqual({ rows: [], total: NaN, page: NaN, pageSize: NaN, totalPages: NaN });
  });
});
