import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { inventoryAdjustmentDocumentModel } from '../src/components/print/inventory-adjustment-document-print';
import { PrintDocument } from '../src/components/print/PrintDocument';
import type { InventoryAdjustment, InventoryAdjustmentLine } from '../src/lib/admin-types';
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
jest.mock('../src/lib/auth-context', () => ({ useAuth: () => ({ activeContext: { companyId: 'company-a', branchId: 'branch-a', companyName: 'Company A', companyNameEn: 'Company A', companyNameAr: 'شركة أ', branchName: 'Branch A', branchNameEn: 'Branch A', branchNameAr: 'فرع أ' }, archivedContext: null, isArchivedContext: false, contextVersion: 1, contextLoading: false, user: { id: 'reviewer', name: 'Reviewer' }, permissions: { permissions: ['inventory-adjustment:read'] }, isSuperAdmin: false }) }));
jest.mock('../src/components/admin/error-modal', () => ({ useErrorModal: () => ({ showError: mockDialog }) }));
jest.mock('../src/components/admin/error-handler', () => ({ useApiErrorHandler: () => mockDialog }));
jest.mock('../src/components/print/print-runtime', () => ({ openPrintDocument: (...args: any[]) => mockOpen(...args) }));
jest.mock('next/navigation', () => ({ notFound: jest.fn(), useParams: () => ({ id: 'adj-1' }), useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
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
  StatusBadge: () => null, ConfirmDialog: () => null,
}));
jest.mock('../src/components/admin/toast-provider', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));

const Page = require('../src/app/admin/inventory/adjustments/[id]/page').default;
const api = require('../src/lib/api').api;

const TECHNICAL_IDS = [
  'private-adjustment', 'private-line-1', 'private-line-2', 'private-product-1', 'private-product-2',
  'private-company', 'private-branch', 'private-warehouse', 'private-location',
  'private-count-id', 'private-creator', 'private-poster', 'private-canceller',
  'private-request', 'private-balance', 'private-movement', 'private-lock',
];
const forbidden = /private-adjustment|private-line-|private-product-|private-company|private-branch|private-warehouse|private-location|private-count-id|private-creator|private-poster|private-canceller|private-request|private-balance|private-movement|private-lock|adjustmentId|companyId|branchId|warehouseId|warehouseLocationId|productId|inventoryCountId|countId|countLineId|createdById|postedById|cancelledById|lockVersion|requestId|_count|afterQty|currentBalance|unitCost|lineCost|totalCost|InventoryMovement|NaN|Invalid Date|reports\.printDocument\.|<button|<input|<select|<nav|>undefined<|>null</i;

function line(overrides: Partial<InventoryAdjustmentLine> = {}): InventoryAdjustmentLine {
  return {
    id: 'private-line-1',
    adjustmentId: 'private-adjustment',
    productId: 'private-product-1',
    warehouseLocationId: 'private-location',
    systemQty: 100,
    countedQty: 92,
    differenceQty: -8,
    notes: 'Shelf recount adjustment.',
    product: { id: 'private-product-1', code: 'SP-1001', name: 'Bearing', unit: 'PCS' },
    warehouseLocation: { id: 'private-location', code: 'A-01', name: 'Rack A-01' },
    ...overrides,
    // Extra fields present only to prove the adapter does not print them.
    ...({ afterQty: 9999, currentBalanceQty: 9999, unitCost: '48321.75', lineCost: '386574', currencyCode: 'USD', batchNumber: 'LOT-77', serialNumber: 'SN-9', lotId: 'LOT-X' } as any),
  } as InventoryAdjustmentLine;
}

function adjustment(overrides: Partial<InventoryAdjustment> = {}): InventoryAdjustment {
  return {
    id: 'private-adjustment',
    adjustmentNumber: 'ADJ-000145',
    companyId: 'private-company',
    branchId: 'private-branch',
    warehouseId: 'private-warehouse',
    inventoryCountId: 'private-count-id',
    status: 'POSTED',
    adjustmentDate: '2026-11-12T00:00:00Z',
    reason: 'Cycle count variance correction',
    notes: 'Monthly adjustment.\nSecond line of note.',
    postedAt: '2026-11-12T15:45:00Z',
    postedById: 'private-poster',
    cancelledAt: null,
    createdAt: '2026-11-11T16:00:00Z',
    updatedAt: '2026-11-12T15:45:00Z',
    company: { id: 'private-company', name: 'Company A' },
    branch: { id: 'private-branch', name: 'Branch A' },
    warehouse: { id: 'private-warehouse', code: 'WH-JOB-RAW-001', name: 'Raw Materials Store' },
    inventoryCount: { id: 'private-count-id', countNumber: 'IC-000145', status: 'COMPLETED' },
    lines: [
      line({
        id: 'private-line-2',
        productId: 'private-product-2',
        systemQty: 4,
        countedQty: 6,
        differenceQty: 2,
        notes: null,
        product: { id: 'private-product-2', code: 'RM-2002', name: 'Raw material', unit: 'KG' },
        warehouseLocation: { id: 'private-location', code: 'B-02', name: 'Rack B-02' },
      }),
      line(),
    ],
    ...overrides,
    ...({ createdById: 'private-creator', cancelledById: 'private-canceller', lockVersion: 7, requestId: 'private-request', movementId: 'private-movement', _count: { lines: 2 } } as any),
  } as InventoryAdjustment;
}

function renderDocument(data: InventoryAdjustment, locale: 'en' | 'ar') {
  mockLocale = locale;
  const model = inventoryAdjustmentDocumentModel(data, mockT, locale);
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

describe('inventory adjustment business document', () => {
  it.each(['ar', 'en'] as const)('IAD-P01/P02/P04/P05/P06/P07/P08 renders the %s document with business identity, context, warehouse, count ref and line UOMs', locale => {
    const { model, html } = renderDocument(adjustment(), locale);
    expect(model.mode).toBe('DOCUMENT');
    expect(model.documentNumber).toBe('ADJ-000145');
    expect(model.title).toBe(mockT('inventoryCounting.adjustment'));
    expect(model.scopeLabel).toBe(mockT('reports.printDocument.adjustmentDocumentScope'));
    expect(model.paperSize).toBe('A4');
    expect(model.orientation).toBe('portrait');
    expect(html).toContain('Company A');
    expect(html).toContain('Branch A');

    const metadata = model.metadata || [];
    expect(metadata.find(f => f.label === mockT('inventoryCounting.adjustmentDate'))?.value).toBeTruthy();
    expect(metadata.find(f => f.label === mockT('inventoryCounting.warehouse'))?.value).toBe('[WH-JOB-RAW-001] Raw Materials Store');
    expect(metadata.find(f => f.label === mockT('inventoryCounting.reason'))?.value).toBe('Cycle count variance correction');
    expect(metadata.find(f => f.label === mockT('inventoryCounting.count'))?.value).toBe('IC-000145');
    expect(metadata.find(f => f.label === mockT('inventoryCounting.postedAt'))?.value).toBeTruthy();
    expect(metadata.find(f => f.label === mockT('common.createdAt'))?.value).toBeTruthy();
    expect(metadata.find(f => f.label === mockT('common.updatedAt'))?.value).toBeTruthy();

    expect(model.sections.map(s => s.title)).toEqual([mockT('details.inventoryAdjustment.lines')]);
    const keys = model.sections[0].columns.map(c => c.key);
    expect(keys).toEqual(expect.arrayContaining(['rowNumber', 'productCode', 'productName', 'unit', 'systemQty', 'countedQty', 'differenceQty', 'location', 'lineNotes']));

    for (const expected of [
      'ADJ-000145', '[WH-JOB-RAW-001] Raw Materials Store', 'IC-000145', 'Cycle count variance correction',
      'SP-1001', 'Bearing', 'RM-2002', 'Raw material', 'PCS', 'KG', '[A-01] Rack A-01', '[B-02] Rack B-02',
      'Shelf recount adjustment.', 'Monthly adjustment.', 'Second line of note.',
      mockT('reports.printDocument.adjustmentDocumentNote'),
    ]) expect(html).toContain(expected);
    expect(html).not.toContain('private-count-id');
    expect(html).not.toMatch(forbidden);
  });

  it('IAD-P03 refuses to print without the generated business adjustment number', () => {
    expect(() => inventoryAdjustmentDocumentModel({ ...adjustment(), adjustmentNumber: '' }, mockT, 'en')).toThrow('unavailable');
    const missing = adjustment(); (missing as any).adjustmentNumber = undefined;
    expect(() => inventoryAdjustmentDocumentModel(missing, mockT, 'en')).toThrow('unavailable');
  });

  it('IAD-P04 prints the canonical status as a localized field', () => {
    for (const locale of ['ar', 'en'] as const) {
      const { model } = renderDocument(adjustment(), locale);
      const status = (model.metadata || []).find(f => f.label === mockT('common.status'))?.value;
      expect(status).toBe(mockT('status.POSTED'));
    }
  });

  it('IAD-P06 prints readable location per line and omits location column when no readable location exists', () => {
    const withLocation = renderDocument(adjustment(), 'en');
    expect(withLocation.model.sections[0].columns.map(c => c.key)).toContain('location');
    expect(withLocation.html).toContain('[A-01] Rack A-01');
    expect(withLocation.html).not.toContain('private-location');

    const withoutLocation = adjustment({ lines: [line({ warehouseLocation: undefined, warehouseLocationId: null, notes: 'n' })] });
    const rendered = renderDocument(withoutLocation, 'en');
    expect(rendered.model.sections[0].columns.map(c => c.key)).not.toContain('location');
    expect(rendered.html).not.toContain('private-location');
  });

  it('IAD-P09/P10/P11 prints stored historical quantities and sign, never after/current/live balance and never recomputes', () => {
    const data = adjustment({ lines: [line({ systemQty: 100, countedQty: 92, differenceQty: -8 })] });
    // Live balance/current/after projections smuggled in must never appear.
    (data as any).inventoryBalance = { quantity: 9999, id: 'private-balance' };
    (data.lines![0] as any).inventoryBalance = { quantity: 9999, id: 'private-balance' };
    (data.lines![0] as any).currentQty = 9999;
    (data.lines![0] as any).currentBalanceQty = 9999;
    (data.lines![0] as any).afterQty = 9999;
    (data.lines![0] as any).balanceAfter = 9999;

    const { model, html } = renderDocument(data, 'en');
    const section = model.sections[0];
    const systemCol = section.columns.find(c => c.key === 'systemQty')!;
    const countedCol = section.columns.find(c => c.key === 'countedQty')!;
    const diffCol = section.columns.find(c => c.key === 'differenceQty')!;
    const row = section.rows[0];
    expect(systemCol.value(row)).toBe(100);
    expect(countedCol.value(row)).toBe(92);
    expect(diffCol.value(row)).toBe(-8);
    expect(diffCol.format!(diffCol.value(row))).toBe('-8');
    expect(html).toContain('100');
    expect(html).toContain('92');
    expect(html).toContain('-8');
    expect(html).not.toContain('9999');
    expect(html).not.toContain('9,999');
    expect(html).not.toContain('private-balance');
    expect(section.columns.map(c => c.key)).not.toContain('afterQty');
    expect(section.columns.map(c => c.key)).not.toContain('currentBalance');
  });

  it('IAD-P12/P13 shows count reference by number only and never prints movement reference/cost fields', () => {
    const { model, html } = renderDocument(adjustment(), 'en');
    const metadata = model.metadata || [];
    expect(metadata.find(f => f.label === mockT('inventoryCounting.count'))?.value).toBe('IC-000145');
    expect(html).toContain('IC-000145');
    expect(html).not.toContain('private-count-id');
    expect(html).not.toContain('private-movement');
    expect(html).not.toContain('InventoryMovement');
    expect(html).not.toContain('48321.75');
    expect(html).not.toContain('386574');
    expect(html).not.toContain('USD');
    const keys = model.sections[0].columns.map(c => c.key);
    for (const absent of ['movement', 'movementReference', 'afterQty', 'unitCost', 'lineCost', 'currency', 'batch', 'lot', 'serial']) {
      expect(keys).not.toContain(absent);
    }
  });

  it('IAD-P14/P16 uses line count only, never sums quantities across mixed or missing units, and never computes totals', () => {
    const mixed = adjustment({
      lines: [
        line({ id: 'private-line-1', systemQty: 200000, countedQty: 200000, differenceQty: 0, product: { id: 'private-product-1', code: 'RM-1', name: 'Raw', unit: 'KG' } }),
        line({ id: 'private-line-2', systemQty: 1000000, countedQty: 1000000, differenceQty: 0, product: { id: 'private-product-2', code: 'PK-2', name: 'Pack', unit: 'PCS' } }),
      ],
    });
    const { model, html } = renderDocument(mixed, 'en');
    expect(model.sections[0].totals).toBeUndefined();
    expect((model.summary || []).map(f => f.label)).toEqual([mockT('inventoryCounting.lineCount')]);
    expect((model.summary || []).map(f => f.value)).toEqual(['2']);
    expect(html).not.toContain('1,200,000');
    expect(html).not.toContain('1200000');
    expect(html).toContain('200,000');
    expect(html).toContain('1,000,000');
  });

  it('IAD-P15 redacts internal identifiers, sensitive fields and app chrome', () => {
    const { model, html } = renderDocument(adjustment(), 'en');
    for (const id of TECHNICAL_IDS) expect(html).not.toContain(id);
    expect(html).not.toMatch(forbidden);
    expect(html).not.toContain('LOT-77');
    expect(html).not.toContain('SN-9');
    expect(html).not.toContain('LOT-X');
    expect(model.documentNumber).toBe('ADJ-000145');
  });

  it('IAD-P17 renders a localized empty state for a legacy zero-line adjustment', () => {
    const empty = adjustment({ adjustmentNumber: 'ADJ-000146', status: 'DRAFT', postedAt: null, cancelledAt: null, notes: null, reason: null, inventoryCount: undefined, inventoryCountId: null, branch: undefined, lines: [] });
    const { model, html } = renderDocument(empty, 'en');
    const metadataValue = (label: string) => (model.metadata || []).find(f => f.label === label)?.value;
    expect(metadataValue(mockT('inventoryCounting.postedAt'))).toBeUndefined();
    expect(metadataValue(mockT('inventoryCounting.cancelledAt'))).toBeUndefined();
    expect(metadataValue(mockT('inventoryCounting.reason'))).toBeUndefined();
    expect(metadataValue(mockT('inventoryCounting.count'))).toBeUndefined();
    expect(model.notes).toEqual([mockT('reports.printDocument.adjustmentDocumentNote')]);
    expect(model.sections[0].rows).toEqual([]);
    expect((model.summary || [])[0].value).toBe('0');
    expect(html).toContain(mockT('reports.printDocument.empty'));
    expect(html).not.toContain('>undefined<');
    expect(html).not.toContain('>null<');
  });

  it('IAD-P18 keeps every adjustment line exactly once in a multipage model', () => {
    const long = adjustment({
      lines: Array.from({ length: 120 }, (_, index) => line({
        id: `private-line-${index + 1}`,
        productId: `private-product-${index + 1}`,
        warehouseLocationId: `private-location-${index + 1}`,
        systemQty: index + 1,
        countedQty: index + 1,
        differenceQty: 0,
        notes: null,
        product: { id: `private-product-${index + 1}`, code: `ITEM-${String(index + 1).padStart(3, '0')}`, name: `Item ${index + 1}`, unit: index % 2 ? 'KG' : 'PCS' },
        warehouseLocation: { id: `private-location-${index + 1}`, code: `L-${String(index + 1).padStart(3, '0')}`, name: `Location ${index + 1}` },
      })),
    });

    const { model } = renderDocument(long, 'en');
    const rows = model.sections[0].rows;
    expect(rows).toHaveLength(120);
    expect(new Set(rows.map(r => r.lineNumber)).size).toBe(120);
    expect(new Set(rows.map(r => r.line.product?.code)).size).toBe(120);
    expect(rows[0].lineNumber).toBe(1);
    expect(rows[119].lineNumber).toBe(120);
    expect(new Set(rows.map(r => r.line.product?.code))).toEqual(new Set(Array.from({ length: 120 }, (_, i) => `ITEM-${String(i + 1).padStart(3, '0')}`)));
  });

  it('IAD-P20 renders the same model values into the printable HTML for Arabic and English', () => {
    for (const locale of ['ar', 'en'] as const) {
      const { model, html } = renderDocument(adjustment(), locale);
      const text = html.replace(/<[^>]+>/g, ' ');
      const expected = [
        ...(model.metadata || []).map(f => f.value),
        ...(model.summary || []).map(f => f.value),
        ...model.sections.flatMap(section => section.rows.flatMap(row => section.columns.map(col => {
          const value = col.value(row);
          return col.format ? col.format(value) : value;
        }))),
        ...(model.notes || []),
      ];
      for (const value of expected) {
        if (value == null || value === '') continue;
        expect(text).toContain(String(value));
      }
    }
  });

  it('omits line notes column when no line has notes', () => {
    const noNotes = adjustment({ lines: [line({ notes: null })] });
    const { model } = renderDocument(noNotes, 'en');
    expect(model.sections[0].columns.map(c => c.key)).not.toContain('lineNotes');
  });

  it('does not reference Stock Adjustment contracts or routes', () => {
    const { html } = renderDocument(adjustment(), 'en');
    expect(html).not.toContain('Stock Adjustment');
    expect(html).not.toContain('stock-adjustment');
    expect(html).not.toContain('stockAdjustments');
  });
});

describe('actual adjustment page through the shared engine', () => {
  let tree: any;
  let documentOverride: InventoryAdjustment | null = null;
  let denied = false;
  const detailUrl = '/inventory/adjustments/adj-1';

  const printAction = () => mockActions.find(item => item.id === 'print');

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLocale = 'en';
    mockActions = [];
    documentOverride = null;
    denied = false;
    api.get.mockImplementation((url: string) => {
      if (url === detailUrl) {
        if (denied) return Promise.reject(new Error('Denied'));
        return Promise.resolve(documentOverride || adjustment());
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    await act(async () => { tree = create(React.createElement(Page)); });
  });
  afterEach(() => act(() => { if (tree) tree.unmount(); }));

  it('IAD-P19 re-reads the canonical adjustment document at print time and prints the shared document', async () => {
    expect(printAction()).toBeTruthy();
    expect(printAction().enabled).toBe(true);
    expect(printAction().permission).toBe('inventory-adjustment:read');
    expect(api.get.mock.calls.filter((call: any[]) => call[0] === detailUrl)).toHaveLength(1);

    documentOverride = adjustment({ notes: 'Notes recorded just before printing.' });
    await act(async () => { await printAction().onClick(); });

    const detailCalls = api.get.mock.calls.filter((call: any[]) => call[0] === detailUrl);
    expect(detailCalls).toHaveLength(2);
    expect(mockOpen).toHaveBeenCalledTimes(1);
    const model = mockOpen.mock.calls[0][0];
    expect(model.mode).toBe('DOCUMENT');
    expect(model.documentNumber).toBe('ADJ-000145');
    expect(model.company).toBe('Company A');
    expect(model.branch).toBe('Branch A');
    expect(model.printedBy).toBe('Reviewer');
    expect((model.metadata || []).find((f: any) => f.label === mockT('inventoryCounting.warehouse'))?.value).toBe('[WH-JOB-RAW-001] Raw Materials Store');
    expect((model.notes || []).join(' ')).toContain('Notes recorded just before printing.');
  });

  it('IAD-P20 opens no document when the print-time read is denied', async () => {
    // Initial mount already loaded successfully. Deny the print-time re-read only.
    api.get.mockImplementation((url: string) => {
      if (url === detailUrl) return Promise.reject(new Error('Denied'));
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    await act(async () => { await printAction().onClick(); });
    expect(mockOpen).not.toHaveBeenCalled();
    expect(mockDialog).toHaveBeenCalled();
  });

  it('IAD-P21 uses the runtime print timestamp, not the adjustment date or page load time', async () => {
    await act(async () => { await printAction().onClick(); });
    const model = mockOpen.mock.calls[0][0];
    expect(model.printedAt).toBeInstanceOf(Date);
    expect(model.printedAt.toISOString()).not.toBe(adjustment().adjustmentDate);
    expect(model.printedBy).toBe('Reviewer');
    expect(model.timeZone).toBeTruthy();
  });

  it('keeps user-facing controls and chrome out of the document', async () => {
    await act(async () => { await printAction().onClick(); });
    const model = mockOpen.mock.calls[0][0];
    const body = renderToStaticMarkup(React.createElement(PrintDocument, { model, t: mockT }));
    expect(body).not.toMatch(/<(button|input|select|nav)\b/);
    expect(body).not.toContain('inventory-adjustment:post');
  });
});
