import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { inventoryStockAdjustmentDocumentModel } from '../src/components/print/inventory-stock-adjustment-document-print';
import { inventoryAdjustmentDocumentModel } from '../src/components/print/inventory-adjustment-document-print';
import { PrintDocument } from '../src/components/print/PrintDocument';
import type { InventoryStockAdjustment, InventoryStockAdjustmentLine } from '../src/lib/admin-types';
const { act, create } = require('react-test-renderer');

let mockLocale: 'en' | 'ar' = 'en';
let mockActions: any[] = [];
const mockT = (key: string): string => {
  const value = key.split('.').reduce<any>((node, part) => node?.[part], mockLocale === 'ar' ? ar : en);
  if (typeof value !== 'string') throw new Error(`Missing ${key}`);
  return value;
};
const mockOpen = jest.fn(async (..._args: any[]) => {});
const mockDialog = jest.fn();

jest.mock('../src/lib/i18n/use-translation', () => ({ useTranslation: () => ({ t: mockT, locale: mockLocale, dir: mockLocale === 'ar' ? 'rtl' : 'ltr' }) }));
jest.mock('../src/lib/auth-context', () => ({ useAuth: () => ({ activeContext: { companyId: 'company-a', branchId: 'branch-a', companyName: 'Company A', companyNameEn: 'Company A', companyNameAr: 'Company A', branchName: 'Branch A', branchNameEn: 'Branch A', branchNameAr: 'Branch A' }, archivedContext: null, isArchivedContext: false, contextVersion: 1, contextLoading: false, user: { id: 'reviewer', name: 'Reviewer' }, permissions: { permissions: ['inventory:stock-adjustment:read'] }, isSuperAdmin: false }) }));
jest.mock('../src/components/admin/error-modal', () => ({ useErrorModal: () => ({ showError: mockDialog }) }));
jest.mock('../src/components/admin/error-handler', () => ({ useApiErrorHandler: () => mockDialog }));
jest.mock('../src/components/print/print-runtime', () => ({ openPrintDocument: (...args: any[]) => mockOpen(...args) }));
jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'sa-1' }), useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../src/components/admin/admin-action-bar', () => ({
  useRegisterAdminActions: (actions: any[]) => { mockActions = actions; },
  useStableHandlers: (handlers: any) => ({ exec: (name: string) => handlers[name]() }),
  ActionBackIcon: () => null, ActionRefreshIcon: () => null, ActionEditIcon: () => null,
  ActionAddIcon: () => null, ActionDeleteIcon: () => null, ActionPrintIcon: () => null,
  ActionPostIcon: () => null, ActionCancelIcon: () => null, ActionViewIcon: () => null,
}));
jest.mock('../src/components/admin/ui', () => ({
  Button: ({ children, loading: _loading, ...props }: any) => React.createElement('button', props, children),
  Card: ({ children }: any) => React.createElement('div', null, children),
  CardHeader: ({ children }: any) => React.createElement('div', null, children),
  CardContent: ({ children }: any) => React.createElement('div', null, children),
  DataTable: () => null, LoadingState: () => React.createElement('span', null, 'loading'),
  EmptyState: ({ message }: any) => React.createElement('span', null, message),
  ErrorState: ({ message }: any) => React.createElement('span', null, message),
}));
jest.mock('../src/components/admin/toast-provider', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));

const Page = require('../src/app/admin/inventory/stock-adjustments/[id]/page').default;
const api = require('../src/lib/api').api;

const TECHNICAL_IDS = [
  'private-sa', 'private-line-1', 'private-line-2', 'private-product-1', 'private-product-2',
  'private-company', 'private-branch', 'private-warehouse', 'private-location',
  'private-header-location', 'private-movement', 'private-submitter', 'private-approver',
  'private-rejecter', 'private-poster', 'private-canceller', 'private-creator', 'private-updater',
  'private-balance', 'private-request', 'private-lock',
];

const forbidden = /private-|lockVersion|requestId|companyId|branchId|warehouseId|locationId|productId|adjustmentId|submittedById|approvedById|rejectedById|postedById|cancelledById|createdById|updatedById|movementId|_count|beforeQty|afterQty|currentBalance|currentBalanceQty|inventoryBalance|lineValue|totalValue|lineCost|totalCost|rejectionReason|InventoryBalance|<button|<input|<select|<nav|NaN|Invalid Date|reports\.printDocument\.|>undefined<|>null</;

function line(overrides: Partial<InventoryStockAdjustmentLine> = {}): InventoryStockAdjustmentLine {
  return {
    id: 'private-line-1',
    adjustmentId: 'private-sa',
    productId: 'private-product-1',
    locationId: 'private-location',
    adjustmentType: 'ADJUSTMENT_IN',
    quantity: 200,
    movementId: 'private-movement',
    unitCost: '12.5',
    currencyCode: 'USD',
    valuationReason: null,
    notes: 'Line note recorded for the first item.',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-02T09:30:00Z',
    product: { id: 'private-product-1', code: 'FG-1001', name: 'Finished carton', unit: 'KG' },
    ...overrides,
    // Fields that exist on related contracts/screens but must never print.
    ...({
      beforeQty: 9999, afterQty: 9999, currentBalanceQty: 9999,
      inventoryBalance: { id: 'private-balance', quantity: 9999 },
      lineCost: '9999', totalCost: '9999',
    } as any),
  } as InventoryStockAdjustmentLine;
}

function fixture(overrides: Partial<InventoryStockAdjustment> = {}): InventoryStockAdjustment {
  return {
    id: 'private-sa',
    code: 'SA-000145',
    companyId: 'private-company',
    branchId: 'private-branch',
    warehouseId: 'private-warehouse',
    locationId: 'private-header-location',
    status: 'POSTED',
    documentDate: '2026-11-01T00:00:00Z',
    reason: 'Authorized stock correction for the raw materials store.',
    notes: 'First line of the approved stock correction memo.\nSecond line with the controller reference.',
    submittedAt: '2026-11-01T10:00:00Z',
    submittedById: 'private-submitter',
    approvedAt: '2026-11-01T11:00:00Z',
    approvedById: 'private-approver',
    rejectedAt: null,
    rejectedById: 'private-rejecter',
    postedAt: '2026-11-02T09:30:00Z',
    postedById: 'private-poster',
    cancelledAt: null,
    cancelledById: 'private-canceller',
    createdById: 'private-creator',
    updatedById: 'private-updater',
    createdAt: '2026-10-31T07:00:00Z',
    updatedAt: '2026-11-02T09:30:00Z',
    company: { id: 'private-company', name: 'Company A' },
    branch: { id: 'private-branch', name: 'Branch A' },
    warehouse: { id: 'private-warehouse', code: 'WH-JOB-RAW-001', name: 'Raw Materials Store' },
    lines: [
      line(),
      line({
        id: 'private-line-2',
        productId: 'private-product-2',
        adjustmentType: 'ADJUSTMENT_OUT',
        quantity: 10,
        unitCost: null,
        currencyCode: null,
        valuationReason: null,
        notes: null,
        product: { id: 'private-product-2', code: 'RM-2002', name: 'Raw resin', unit: 'PCS' },
      }),
    ],
    _count: { lines: 2 },
    ...overrides,
  };
}

function renderDocument(data: InventoryStockAdjustment, locale: 'en' | 'ar') {
  mockLocale = locale;
  const model = inventoryStockAdjustmentDocumentModel(data, mockT, locale);
  const html = renderToStaticMarkup(React.createElement(PrintDocument, {
    model: {
      ...model,
      locale,
      company: 'Company A',
      branch: 'Branch A',
      printedBy: 'Reviewer',
      printedAt: new Date('2026-11-13T13:45:00Z'),
      timeZone: 'Asia/Aden',
    },
    t: mockT,
  }));
  return { model, html };
}

const metadataValue = (model: any, label: string) => (model.metadata || []).find((field: any) => field.label === label)?.value;
const columnKeys = (model: any) => model.sections[0].columns.map((column: any) => column.key);

describe('inventory stock adjustment business document', () => {
  it.each(['ar', 'en'] as const)('SA-P01/P02 renders the %s document with business identity, context, scope, paper and warehouse', locale => {
    const { model, html } = renderDocument(fixture(), locale);

    expect(model.mode).toBe('DOCUMENT');
    expect(model.documentNumber).toBe('SA-000145');
    expect(model.title).toBe(mockT('inventoryCounting.stockAdjustment'));
    expect(model.scopeLabel).toBe(mockT('reports.printDocument.stockAdjustmentDocumentScope'));
    expect(model.paperSize).toBe('A4');
    expect(model.orientation).toBe('portrait');
    expect(html).toContain('Company A');
    expect(html).toContain('Branch A');
    expect(metadataValue(model, mockT('inventoryCounting.warehouse'))).toBe('[WH-JOB-RAW-001] Raw Materials Store');
  });

  it('SA-P03 refuses to print without the generated business stock adjustment number', () => {
    expect(() => inventoryStockAdjustmentDocumentModel({ ...fixture(), code: '' }, mockT, 'en')).toThrow('unavailable');
    const missing = fixture(); (missing as any).code = undefined;
    expect(() => inventoryStockAdjustmentDocumentModel(missing, mockT, 'en')).toThrow('unavailable');
  });

  it('SA-P04 prints every canonical workflow status as a localized field and never invents one', () => {
    for (const status of ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED'] as const) {
      for (const locale of ['ar', 'en'] as const) {
        const { model } = renderDocument(fixture({ status }), locale);
        expect(metadataValue(model, mockT('common.status'))).toBe(mockT(`status.${status}`));
      }
    }
  });

  it('SA-P05 prints the recorded document date and reason and omits an empty reason', () => {
    const { model } = renderDocument(fixture(), 'en');
    expect(metadataValue(model, mockT('inventoryCounting.documentDate'))).toBeTruthy();
    expect(metadataValue(model, mockT('inventoryCounting.reason'))).toBe('Authorized stock correction for the raw materials store.');

    const noReason = renderDocument(fixture({ reason: '' }), 'en');
    expect(metadataValue(noReason.model, mockT('inventoryCounting.reason'))).toBeUndefined();
  });

  it('SA-P06 prints the warehouse by code and name only', () => {
    const { html } = renderDocument(fixture(), 'en');
    expect(html).toContain('[WH-JOB-RAW-001] Raw Materials Store');
    expect(html).not.toContain('private-warehouse');
  });

  it('SA-P07 prints each line product code, name and the canonical source UOM', () => {
    const { model, html } = renderDocument(fixture(), 'en');
    expect(columnKeys(model)).toEqual(expect.arrayContaining(['productCode', 'productName', 'unit']));
    expect(html).toContain('FG-1001');
    expect(html).toContain('Finished carton');
    expect(html).toContain('RM-2002');
    expect(html).toContain('Raw resin');
    expect(html).toContain('KG');
    expect(html).toContain('PCS');
  });

  it('SA-P08 prints the stored adjustmentType as the localized direction and never derives it', () => {
    const { model } = renderDocument(fixture(), 'en');
    const typeColumn = model.sections[0].columns.find((column: any) => column.key === 'adjustmentType')!;
    const values = model.sections[0].rows.map((row: any) => typeColumn.value(row));
    expect(values).toEqual([mockT('status.ADJUSTMENT_IN'), mockT('status.ADJUSTMENT_OUT')]);
    expect(model.sections[0].columns.map((column: any) => column.key)).not.toContain('direction');
    expect(model.sections[0].columns.map((column: any) => column.key)).not.toContain('sign');
  });

  it('SA-P09 keeps the recorded positive quantity and never inverts or absolute-values it based on direction', () => {
    const { model, html } = renderDocument(fixture(), 'en');
    const quantityColumn = model.sections[0].columns.find((column: any) => column.key === 'quantity')!;
    const values = model.sections[0].rows.map((row: any) => quantityColumn.value(row));
    expect(values).toEqual([200, 10]);
    expect(values.every((value: any) => Number(value) > 0)).toBe(true);
    expect(html).toContain('200');
    expect(html).toContain('10');
    expect(html).not.toContain('>-10<');
  });

  it('SA-P10 prints no before quantity and never substitutes a live inventory balance', () => {
    const data = fixture();
    (data as any).inventoryBalance = { id: 'private-balance', quantity: 9999 };
    const { model, html } = renderDocument(data, 'en');
    expect(columnKeys(model)).not.toContain('beforeQty');
    expect(columnKeys(model)).not.toContain('systemQty');
    expect(columnKeys(model)).not.toContain('currentBalance');
    expect(html).not.toContain('9999');
    expect(html).not.toContain('9,999');
    expect(html).not.toContain('private-balance');
  });

  it('SA-P11 stores no after quantity, so none is printed or derived', () => {
    const { model, html } = renderDocument(fixture(), 'en');
    expect(columnKeys(model)).not.toContain('afterQty');
    expect(columnKeys(model)).not.toContain('balanceAfter');
    expect(html).not.toContain('afterQty');
    expect(html).not.toContain('9999');
  });

  it('SA-P12 omits warehouse location because the canonical detail exposes no readable location (LOCATION = NOT_APPLICABLE)', () => {
    const { model, html } = renderDocument(fixture(), 'en');
    expect(columnKeys(model)).not.toContain('location');
    const thead = html.match(/<thead>[\s\S]*?<\/thead>/)?.[0] || '';
    expect(thead).not.toContain(`>${mockT('inventoryCounting.warehouseLocation')}<`);
    expect(html).not.toContain('private-location');
    expect(html).not.toContain('private-header-location');
  });

  it('SA-P13 omits the movement reference because the canonical detail exposes no business movement number (MOVEMENT_REFERENCE = OMITTED_SOURCE_NOT_READABLE)', () => {
    const { model, html } = renderDocument(fixture(), 'en');
    expect(columnKeys(model)).not.toContain('movement');
    expect(columnKeys(model)).not.toContain('movementReference');
    expect((model.metadata || []).map((field: any) => field.label)).not.toContain(mockT('inventoryCounting.movement'));
    expect(html).not.toContain('private-movement');
    expect(html).not.toContain('IM-');
  });

  it('SA-P14 prints unit cost and currency only when recorded on the line, never for unvalued OUT lines', () => {
    const withCosts = renderDocument(fixture(), 'en');
    expect(columnKeys(withCosts.model)).toContain('unitCost');
    expect(columnKeys(withCosts.model)).toContain('currency');
    const costColumn = withCosts.model.sections[0].columns.find((column: any) => column.key === 'unitCost')!;
    expect(costColumn.value(withCosts.model.sections[0].rows[0])).toBe('12.5');
    expect(costColumn.value(withCosts.model.sections[0].rows[1])).toBeNull();
    expect(withCosts.html).toContain('12.5');
    expect(withCosts.html).toContain('USD');

    const withoutCosts = fixture();
    withoutCosts.lines = (withoutCosts.lines || []).map(item => ({ ...item, unitCost: null, currencyCode: null }));
    const rendered = renderDocument(withoutCosts, 'en');
    expect(columnKeys(rendered.model)).not.toContain('unitCost');
    expect(columnKeys(rendered.model)).not.toContain('currency');
    expect(rendered.html).not.toContain('12.5');
    expect(rendered.html).not.toContain('USD');
  });

  it('SA-P15 computes no line value, document total, cross-currency total or valuation', () => {
    const { model, html } = renderDocument(fixture(), 'en');
    expect(model.sections[0].totals).toBeUndefined();
    expect((model.summary || []).map((field: any) => field.label)).toEqual([mockT('inventoryCounting.lineCount')]);
    expect((model.summary || []).map((field: any) => field.value)).toEqual(['2']);
    expect(columnKeys(model)).not.toContain('lineValue');
    expect(columnKeys(model)).not.toContain('totalValue');
    expect(html).not.toContain('2,500');
    expect(html).not.toContain('2500');
  });

  it('SA-P16 prints the recorded valuation reason only when present and never invents one', () => {
    const withReason = fixture();
    withReason.lines = [line({ valuationReason: 'Recovered scrap valuation basis' }), line({ id: 'private-line-2', productId: 'private-product-2', adjustmentType: 'ADJUSTMENT_OUT', unitCost: null, currencyCode: null, valuationReason: null, notes: null, product: { id: 'private-product-2', code: 'RM-2002', name: 'Raw resin', unit: 'PCS' } })];
    const rendered = renderDocument(withReason, 'en');
    expect(columnKeys(rendered.model)).toContain('valuationReason');
    expect(rendered.html).toContain('Recovered scrap valuation basis');

    const withoutReason = renderDocument(fixture(), 'en');
    expect(columnKeys(withoutReason.model)).not.toContain('valuationReason');
    expect(withoutReason.html).not.toContain('Recovered scrap valuation basis');
  });

  it('SA-P17 redacts every internal identifier and does not print application chrome', () => {
    const { html } = renderDocument(fixture(), 'en');
    for (const id of TECHNICAL_IDS) expect(html).not.toContain(id);
    expect(html).not.toMatch(forbidden);
  });

  it('SA-P18 prints stored workflow timestamps for submission, approval, rejection, posting and cancellation only when present', () => {
    const posted = renderDocument(fixture(), 'en');
    expect(metadataValue(posted.model, mockT('inventoryCounting.submittedAt'))).toBeTruthy();
    expect(metadataValue(posted.model, mockT('inventoryCounting.approvedAt'))).toBeTruthy();
    expect(metadataValue(posted.model, mockT('inventoryCounting.postedAt'))).toBeTruthy();
    expect(metadataValue(posted.model, mockT('inventoryCounting.rejectedAt'))).toBeUndefined();
    expect(metadataValue(posted.model, mockT('inventoryCounting.cancelledAt'))).toBeUndefined();

    const rejected = renderDocument(fixture({ status: 'REJECTED', postedAt: null, rejectedAt: '2026-11-03T08:15:00Z' }), 'en');
    expect(metadataValue(rejected.model, mockT('inventoryCounting.rejectedAt'))).toBeTruthy();
    expect(metadataValue(rejected.model, mockT('inventoryCounting.postedAt'))).toBeUndefined();
    expect(metadataValue(rejected.model, mockT('inventoryCounting.approvedAt'))).toBeTruthy();
  });

  it('SA-P19 omits absent workflow timestamps completely', () => {
    const draft = renderDocument(fixture({ status: 'DRAFT', submittedAt: null, approvedAt: null, rejectedAt: null, postedAt: null, cancelledAt: null }), 'en');
    for (const label of ['submittedAt', 'approvedAt', 'rejectedAt', 'postedAt', 'cancelledAt']) {
      expect(metadataValue(draft.model, mockT(`inventoryCounting.${label}`))).toBeUndefined();
    }
  });

  it('SA-P20 never prints workflow actor identities, only their timestamps', () => {
    const { html } = renderDocument(fixture(), 'en');
    for (const id of ['private-submitter', 'private-approver', 'private-rejecter', 'private-poster', 'private-canceller', 'private-creator', 'private-updater']) {
      expect(html).not.toContain(id);
    }
    expect((html.match(/private-/g) || []).length).toBe(0);
  });

  it('SA-P21 shows no rejection reason because the canonical contract stores none (NOT_APPLICABLE)', () => {
    const { model, html } = renderDocument(fixture({ status: 'REJECTED' }), 'en');
    expect(columnKeys(model)).not.toContain('rejectionReason');
    expect((model.metadata || []).map((field: any) => field.label)).not.toContain(mockT('inventoryValuation.valuationReason') + ' (rejection)');
    expect(html).not.toContain('rejectionReason');
  });

  it('SA-P22 renders a localized empty state for a zero-line legacy adjustment', () => {
    const empty = fixture({ code: 'SA-000146', status: 'DRAFT', notes: null, reason: '', submittedAt: null, approvedAt: null, rejectedAt: null, postedAt: null, cancelledAt: null, lines: [] });
    const { model, html } = renderDocument(empty, 'en');
    expect(model.notes).toEqual([mockT('reports.printDocument.stockAdjustmentDocumentNote')]);
    expect(model.sections[0].rows).toEqual([]);
    expect((model.summary || [])[0].value).toBe('0');
    expect(html).toContain(mockT('reports.printDocument.empty'));
    expect(html).not.toContain('>undefined<');
    expect(html).not.toContain('>null<');
  });

  it('SA-P23 keeps every stock adjustment line exactly once in a 120-line multipage model', () => {
    const long = fixture({
      lines: Array.from({ length: 120 }, (_, index) => line({
        id: `private-line-${index + 1}`,
        productId: `private-product-${index + 1}`,
        adjustmentType: index % 2 ? 'ADJUSTMENT_OUT' : 'ADJUSTMENT_IN',
        quantity: index + 1,
        unitCost: index % 2 ? null : '5.5',
        currencyCode: index % 2 ? null : 'USD',
        valuationReason: null,
        notes: null,
        product: { id: `private-product-${index + 1}`, code: `ITEM-${String(index + 1).padStart(3, '0')}`, name: `Item ${index + 1}`, unit: index % 2 ? 'PCS' : 'KG' },
      })),
    });

    const { model } = renderDocument(long, 'en');
    const rows = model.sections[0].rows;
    expect(rows).toHaveLength(120);
    expect(new Set(rows.map((row: any) => row.lineNumber)).size).toBe(120);
    expect(rows[0].lineNumber).toBe(1);
    expect(rows[119].lineNumber).toBe(120);
    expect(rows.map((row: any) => row.line.product?.code)).toEqual(Array.from({ length: 120 }, (_, index) => `ITEM-${String(index + 1).padStart(3, '0')}`));
  });

  it('SA-P24 renders the same model values into the printable HTML for Arabic and English', () => {
    for (const locale of ['ar', 'en'] as const) {
      const { model, html } = renderDocument(fixture(), locale);
      const text = html.replace(/<[^>]+>/g, ' ');
      const expected = [
        ...(model.metadata || []).map((field: any) => field.value),
        ...(model.summary || []).map((field: any) => field.value),
        ...model.sections.flatMap((section: any) => section.rows.flatMap((row: any) => section.columns.map((column: any) => {
          const value = column.value(row);
          return column.format ? column.format(value) : value;
        }))),
        ...(model.notes || []),
      ];
      for (const value of expected) {
        if (value == null || value === '') continue;
        expect(text).toContain(String(value));
      }
    }
  });
});

describe('actual stock adjustment page through the shared engine', () => {
  let tree: any;
  let detailOverride: InventoryStockAdjustment | null = null;
  let denied = false;
  const detailUrl = '/inventory/stock-adjustments/sa-1';

  const printAction = () => mockActions.find(item => item.id === 'print');

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLocale = 'en';
    mockActions = [];
    detailOverride = null;
    denied = false;
    api.get.mockImplementation((url: string) => {
      if (url === detailUrl) {
        if (denied) return Promise.reject(new Error('Denied'));
        return Promise.resolve(detailOverride || fixture());
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    await act(async () => { tree = create(React.createElement(Page)); });
  });
  afterEach(() => act(() => { if (tree) tree.unmount(); }));

  it('SA-P25 re-reads the canonical stock adjustment detail at print time and prints the shared document', async () => {
    expect(printAction()).toBeTruthy();
    expect(printAction().enabled).toBe(true);
    expect(printAction().permission).toBe('inventory:stock-adjustment:read');
    detailOverride = { ...fixture(), reason: 'Reason recorded just before printing.' };
    await act(async () => { await printAction().onClick(); });

    const detailCalls = api.get.mock.calls.filter((call: any[]) => call[0] === detailUrl);
    expect(detailCalls).toHaveLength(2);
    expect(mockOpen).toHaveBeenCalledTimes(1);
    const model = mockOpen.mock.calls[0][0];
    expect(model.mode).toBe('DOCUMENT');
    expect(model.documentNumber).toBe('SA-000145');
    expect(model.company).toBe('Company A');
    expect(model.branch).toBe('Branch A');
    expect(model.printedBy).toBe('Reviewer');
    expect(metadataValue(model, mockT('inventoryCounting.reason'))).toBe('Reason recorded just before printing.');
  });

  it('SA-P26 opens no document when the print-time read is denied', async () => {
    denied = true;
    await act(async () => { await printAction().onClick(); });
    expect(mockOpen).not.toHaveBeenCalled();
    expect(mockDialog).toHaveBeenCalled();
  });

  it('SA-P27 uses the runtime print timestamp, not the document date or page load time', async () => {
    await act(async () => { await printAction().onClick(); });
    const model = mockOpen.mock.calls[0][0];
    expect(model.printedAt).toBeInstanceOf(Date);
    expect(model.printedAt.toISOString()).not.toBe(fixture().documentDate);
    expect(model.printedBy).toBe('Reviewer');
    expect(model.timeZone).toBeTruthy();
  });

  it('SA-P28 keeps user-facing controls, permission strings and chrome out of the document', async () => {
    await act(async () => { await printAction().onClick(); });
    const model = mockOpen.mock.calls[0][0];
    const body = renderToStaticMarkup(React.createElement(PrintDocument, { model, t: mockT }));
    expect(body).not.toMatch(/<(button|input|select|nav)\b/);
    expect(body).not.toContain('inventory:stock-adjustment:post');
    expect(body).not.toContain('inventory:stock-adjustment:read');
  });

  it('SA-P29 performs no stock adjustment mutation or movement work from the read-only print page', async () => {
    await act(async () => { await printAction().onClick(); });
    expect(api.post).not.toHaveBeenCalled();
    expect(api.patch).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });
});

describe('related print regression', () => {
  it('legacy inventory adjustment document still prints and does not pick up stock adjustment contracts', () => {
    mockLocale = 'en';
    const model = inventoryAdjustmentDocumentModel({
      id: 'private-adjustment',
      adjustmentNumber: 'ADJ-000145',
      companyId: 'private-company',
      branchId: 'private-branch',
      warehouseId: 'private-warehouse',
      status: 'POSTED',
      adjustmentDate: '2026-11-12T00:00:00Z',
      reason: 'Cycle count variance correction',
      notes: null,
      createdAt: '2026-11-11T16:00:00Z',
      updatedAt: '2026-11-12T15:45:00Z',
      warehouse: { id: 'private-warehouse', code: 'WH-JOB-RAW-001', name: 'Raw Materials Store' },
      lines: [],
    } as any, mockT, 'en');
    expect(model.documentNumber).toBe('ADJ-000145');
    expect(model.scopeLabel).toBe(mockT('reports.printDocument.adjustmentDocumentScope'));
    const html = renderToStaticMarkup(React.createElement(PrintDocument, {
      model: { ...model, locale: 'en', company: 'Company A', printedAt: new Date('2026-11-13T13:45:00Z'), timeZone: 'Asia/Aden' },
      t: mockT,
    }));
    expect(html).not.toContain('SA-000145');
    expect(html).not.toContain(mockT('reports.printDocument.stockAdjustmentDocumentScope'));
  });
});
