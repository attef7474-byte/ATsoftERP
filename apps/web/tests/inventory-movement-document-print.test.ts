import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { inventoryMovementDocumentModel } from '../src/components/print/inventory-movement-document-print';
import { PrintDocument } from '../src/components/print/PrintDocument';
import type { InventoryMovement, InventoryMovementLine } from '../src/lib/admin-types';
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
jest.mock('../src/lib/auth-context', () => ({ useAuth: () => ({ activeContext: { companyId: 'company-a', branchId: 'branch-a', companyName: 'Company A', companyNameEn: 'Company A', companyNameAr: 'Company A', branchName: 'Branch A', branchNameEn: 'Branch A', branchNameAr: 'Branch A' }, archivedContext: null, isArchivedContext: false, contextVersion: 1, contextLoading: false, user: { id: 'reviewer', name: 'Reviewer' }, permissions: { permissions: ['inventory-movement:read'] }, isSuperAdmin: false }) }));
jest.mock('../src/components/admin/error-modal', () => ({ useErrorModal: () => ({ showError: mockDialog }) }));
jest.mock('../src/components/admin/error-handler', () => ({ useApiErrorHandler: () => mockDialog }));
jest.mock('../src/components/print/print-runtime', () => ({ openPrintDocument: (...args: any[]) => mockOpen(...args) }));
jest.mock('next/navigation', () => ({ notFound: jest.fn(), useParams: () => ({ id: 'im-1' }), useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../src/components/admin/admin-action-bar', () => ({
  useRegisterAdminActions: (actions: any[]) => { mockActions = actions; },
  useStableHandlers: (handlers: any) => ({ exec: (name: string) => handlers[name]() }),
  ActionBackIcon: () => null, ActionRefreshIcon: () => null, ActionEditIcon: () => null,
  ActionAddIcon: () => null, ActionDeleteIcon: () => null, ActionPrintIcon: () => null,
  ActionPostIcon: () => null, ActionCancelIcon: () => null,
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

const Page = require('../src/app/admin/inventory/movements/[id]/page').default;
const api = require('../src/lib/api').api;

const TECHNICAL_IDS = [
  'private-im', 'private-line-1', 'private-line-2', 'private-product-1', 'private-product-2',
  'private-company', 'private-branch', 'private-warehouse', 'private-location',
  'private-source', 'private-user', 'private-poster', 'private-canceller',
  'private-request', 'private-reverses',
];

function line(overrides: Partial<InventoryMovementLine> = {}): InventoryMovementLine {
  return {
    id: 'private-line-1',
    movementId: 'private-im',
    productId: 'private-product-1',
    warehouseLocationId: 'private-location',
    quantity: 25,
    quantityBase: '25',
    direction: 'OUT',
    unit: 'PCS',
    batchNumber: 'LOT-77',
    serialNumber: null,
    expiryDate: null,
    unitCost: '12.5',
    totalCost: '312.5',
    currencyCode: 'USD',
    notes: 'Line note recorded for the first item.',
    product: { id: 'private-product-1', code: 'SP-1001', name: 'Bearing' },
    ...overrides,
  };
}

function fixture(): InventoryMovement {
  return {
    id: 'private-im',
    movementNumber: 'IM-000230',
    companyId: 'private-company',
    branchId: 'private-branch',
    warehouseId: 'private-warehouse',
    movementType: 'MAINTENANCE_ISSUE',
    status: 'POSTED',
    direction: 'OUT',
    movementDate: '2026-11-05T00:00:00Z',
    sourceType: 'MAINTENANCE_WORK_ORDER',
    sourceId: 'private-source',
    postedAt: '2026-11-05T10:15:00Z',
    postedById: 'private-poster',
    cancelledAt: null,
    notes: 'First line of the issue memo.\nSecond line with the controller reference.',
    createdAt: '2026-11-04T07:00:00Z',
    updatedAt: '2026-11-05T10:15:00Z',
    company: { id: 'private-company', name: 'Company A' },
    branch: { id: 'private-branch', name: 'Branch A' },
    warehouse: { id: 'private-warehouse', code: 'WH-JOB-RAW-001', name: 'Raw Materials Store' },
    lines: [
      line(),
      line({
        id: 'private-line-2',
        productId: 'private-product-2',
        quantity: 4,
        quantityBase: '4',
        direction: 'IN',
        unit: 'KG',
        batchNumber: null,
        unitCost: null,
        totalCost: null,
        currencyCode: null,
        notes: null,
        product: { id: 'private-product-2', code: 'RM-2002', name: 'Raw material' },
      }),
    ],
    _count: { lines: 2 },
  };
}

function renderDocument(data: InventoryMovement, locale: 'en' | 'ar') {
  mockLocale = locale;
  const model = inventoryMovementDocumentModel(data, mockT, locale);
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

const forbidden = /private-|lockVersion|companyId|branchId|warehouseId|locationId|productId|movementId|requestId|createdById|postedById|cancelledById|sourceId|reversesMovementId|<button|<input|<select|<nav|NaN|Invalid Date|reports\.printDocument\./;

describe('inventory movement business document', () => {
  it.each(['ar', 'en'] as const)('IM-P01/P02/P03/P04/P05/P06/P07/P08 renders the %s document with business identity, context, warehouse and line UOMs', locale => {
    const { model, html } = renderDocument(fixture(), locale);

    expect(model.mode).toBe('DOCUMENT');
    expect(model.documentNumber).toBe('IM-000230');
    expect(model.title).toBe(mockT('inventoryCounting.movement'));
    expect(model.scopeLabel).toBe(mockT('reports.printDocument.movementDocumentScope'));
    expect(model.paperSize).toBe('A4');
    expect(model.orientation).toBe('portrait');
    expect(html).toContain('Company A');
    expect(html).toContain('Branch A');

    const metadataValue = (label: string) => (model.metadata || []).find(field => field.label === label)?.value;
    expect(metadataValue(mockT('inventoryCounting.movementType'))).toBe(mockT('status.MAINTENANCE_ISSUE'));
    expect(metadataValue(mockT('common.status'))).toBe(mockT('status.POSTED'));
    expect(metadataValue(mockT('inventoryCounting.warehouse'))).toBe('[WH-JOB-RAW-001] Raw Materials Store');
    expect(metadataValue(mockT('inventoryCounting.movementDate'))).toBeTruthy();
    expect(metadataValue(mockT('inventoryCounting.postedAt'))).toBeTruthy();

    expect(model.sections.map(section => section.title)).toEqual([mockT('inventoryCounting.lines')]);
    const keys = model.sections[0].columns.map(column => column.key);
    expect(keys).toEqual(expect.arrayContaining([
      'rowNumber', 'productCode', 'productName', 'quantity', 'unit', 'direction',
      'batchNumber', 'unitCost', 'totalCost', 'currency', 'lineNotes',
    ]));
    expect(keys).not.toContain('sourceWarehouse');
    expect(keys).not.toContain('destinationWarehouse');

    for (const expected of [
      'IM-000230', '[WH-JOB-RAW-001] Raw Materials Store', 'SP-1001', 'Bearing', 'RM-2002', 'Raw material',
      'PCS', 'KG', 'LOT-77', '12.5', '312.5', 'USD', '25', '4',
      'Line note recorded for the first item.',
      'First line of the issue memo.',
      'Second line with the controller reference.',
      mockT('reports.printDocument.movementDocumentNote'),
    ]) {
      expect(html).toContain(expected);
    }
    expect(html).not.toMatch(forbidden);
  });

  it('IM-P03 refuses to print without the generated business movement number', () => {
    const noNumber = fixture(); noNumber.movementNumber = '';
    expect(() => inventoryMovementDocumentModel(noNumber, mockT, 'en')).toThrow('unavailable');
    const missing = fixture(); (missing as any).movementNumber = undefined;
    expect(() => inventoryMovementDocumentModel(missing, mockT, 'en')).toThrow('unavailable');
  });

  it('IM-P04 prints movement type and status as separate localized fields', () => {
    for (const locale of ['ar', 'en'] as const) {
      const { model } = renderDocument(fixture(), locale);
      const fields = model.metadata || [];
      expect(fields.find(field => field.label === mockT('inventoryCounting.movementType'))?.value).toBe(mockT('status.MAINTENANCE_ISSUE'));
      expect(fields.find(field => field.label === mockT('common.status'))?.value).toBe(mockT('status.POSTED'));
    }
  });

  it('IM-P06 prints one warehouse and a per-line direction, never empty source/destination labels', () => {
    const { model, html } = renderDocument(fixture(), 'en');
    const fields = model.metadata || [];
    expect(fields.filter(field => field.label === mockT('inventoryCounting.warehouse'))).toHaveLength(1);
    expect(fields.map(field => field.label)).not.toContain(mockT('inventoryCounting.sourceWarehouse'));
    expect(fields.map(field => field.label)).not.toContain(mockT('inventoryCounting.destinationWarehouse'));
    expect(html).not.toContain('Source warehouse');
    expect(html).not.toContain('Destination warehouse');
  });

  it('IM-P09 prints the recorded per-line direction text instead of inferring signs', () => {
    const { model } = renderDocument(fixture(), 'en');
    const direction = model.sections[0].columns.find(column => column.key === 'direction');
    const rows = model.sections[0].rows;
    expect(direction?.value(rows[0])).toBe(mockT('status.OUT'));
    expect(direction?.value(rows[1])).toBe(mockT('status.IN'));
    expect(model.sections[0].rows.map(row => row.line.quantity)).toEqual([25, 4]);
  });

  it('IM-P10 identifies the source reference by localized type only, never the internal source id', () => {
    const { model, html } = renderDocument(fixture(), 'en');
    const source = (model.metadata || []).find(field => field.label === mockT('inventoryCounting.sourceType'));
    expect(source?.value).toBe(mockT('inventoryCounting.movementSourceTypes.MAINTENANCE_WORK_ORDER'));
    expect(html).not.toContain('private-source');
    expect(html).not.toContain('MAINTENANCE_WORK_ORDER');
  });

  it('IM-P11 omits unreadable locations and prints lot/serial/expiry only when recorded', () => {
    const withBatch = renderDocument(fixture(), 'en');
    const keys = withBatch.model.sections[0].columns.map(column => column.key);
    expect(keys).toContain('batchNumber');
    expect(keys).not.toContain('serialNumber');
    expect(keys).not.toContain('expiryDate');
    expect(keys).not.toContain('location');
    expect(keys).not.toContain('warehouseLocation');
    expect(withBatch.html).not.toContain('private-location');

    const full = fixture();
    full.lines = [line({ serialNumber: 'SN-9', expiryDate: '2027-03-31T00:00:00Z' })];
    const rendered = renderDocument(full, 'en');
    const fullKeys = rendered.model.sections[0].columns.map(column => column.key);
    expect(fullKeys).toContain('serialNumber');
    expect(fullKeys).toContain('expiryDate');
    expect(rendered.html).toContain('SN-9');
  });

  it('IM-P12 never creates one quantity total across mixed or missing units', () => {
    const mixed = fixture();
    mixed.lines = [
      line({ id: 'private-line-1', quantity: 200000, unitCost: null, totalCost: null, currencyCode: null, unit: 'KG', product: { id: 'private-product-1', code: 'RM-1', name: 'Raw material' } }),
      line({ id: 'private-line-2', quantity: 1000000, unitCost: null, totalCost: null, currencyCode: null, unit: 'PCS', product: { id: 'private-product-2', code: 'PK-2', name: 'Packing roll' } }),
    ];
    const { model, html } = renderDocument(mixed, 'en');

    expect(model.sections[0].totals).toBeUndefined();
    expect((model.summary || []).map(field => field.label)).toEqual([mockT('inventoryCounting.lineCount')]);
    expect(html).not.toContain('1,200,000');
    expect(html).not.toContain('1200000');
    expect(html).toContain('200,000');
    expect(html).toContain('1,000,000');
  });

  it('IM-P13 prints unit cost, line cost and currency only when recorded and computes no document total', () => {
    const withCosts = renderDocument(fixture(), 'en');
    const keys = withCosts.model.sections[0].columns.map(column => column.key);
    expect(keys).toContain('unitCost');
    expect(keys).toContain('totalCost');
    expect(keys).toContain('currency');
    expect(withCosts.html).toContain('12.5');
    expect(withCosts.html).toContain('312.5');
    expect(withCosts.html).toContain('USD');

    const withoutCosts = fixture();
    withoutCosts.lines = (withoutCosts.lines || []).map(item => ({ ...item, unitCost: null, totalCost: null, currencyCode: null }));
    const rendered = renderDocument(withoutCosts, 'en');
    const plainKeys = rendered.model.sections[0].columns.map(column => column.key);
    expect(plainKeys).not.toContain('unitCost');
    expect(plainKeys).not.toContain('totalCost');
    expect(plainKeys).not.toContain('currency');
    expect(plainKeys).not.toContain('lineValue');
    expect(rendered.html).not.toContain('12.5');
    expect(rendered.html).not.toContain('USD');
  });

  it('IM-P14/P15 redacts internal identifiers, sensitive data and application chrome', () => {
    const { html } = renderDocument(fixture(), 'en');
    for (const id of TECHNICAL_IDS) expect(html).not.toContain(id);
    expect(html).not.toMatch(forbidden);
    expect(html).not.toContain('token');
    expect(html).not.toContain('password');
  });

  it('renders a localized empty state for a zero-line legacy movement', () => {
    const empty = fixture();
    empty.sourceType = null;
    empty.notes = null;
    empty.postedAt = null;
    empty.branch = undefined;
    empty.lines = [];

    const { model, html } = renderDocument(empty, 'en');
    const metadataValue = (label: string) => (model.metadata || []).find(field => field.label === label)?.value;
    expect(metadataValue(mockT('inventoryCounting.postedAt'))).toBeUndefined();
    expect(metadataValue(mockT('inventoryCounting.sourceType'))).toBeUndefined();
    expect(model.notes).toEqual([mockT('reports.printDocument.movementDocumentNote')]);
    expect(model.sections[0].rows).toEqual([]);
    expect(html).toContain(mockT('reports.printDocument.empty'));
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
  });

  it('IM-P18 keeps every line exactly once in a multipage model', () => {
    const long = fixture();
    long.lines = Array.from({ length: 120 }, (_, index) => line({
      id: `private-line-${index + 1}`,
      productId: `private-product-${index + 1}`,
      quantity: index + 1,
      unitCost: null,
      totalCost: null,
      currencyCode: null,
      batchNumber: null,
      notes: null,
      product: { id: `private-product-${index + 1}`, code: `ITEM-${String(index + 1).padStart(3, '0')}`, name: `Item ${index + 1}`, unit: index % 2 ? 'KG' : 'PCS' },
    }));

    const { model } = renderDocument(long, 'en');
    const rows = model.sections[0].rows;
    expect(rows).toHaveLength(120);
    expect(new Set(rows.map(row => row.lineNumber)).size).toBe(120);
    expect(rows[0].lineNumber).toBe(1);
    expect(rows[119].lineNumber).toBe(120);
    expect(rows.map(row => row.line.product?.code)).toEqual(Array.from({ length: 120 }, (_, index) => `ITEM-${String(index + 1).padStart(3, '0')}`));
  });

  it('IM-P20 renders the same model values into the printable HTML for Arabic and English', () => {
    for (const locale of ['ar', 'en'] as const) {
      const { model, html } = renderDocument(fixture(), locale);
      const text = html.replace(/<[^>]+>/g, ' ');
      const expected = [
        ...(model.metadata || []).map(field => field.value),
        ...(model.summary || []).map(field => field.value),
        ...model.sections.flatMap(section => section.rows.flatMap(row => section.columns.map(column => {
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

describe('actual movement page through the shared engine', () => {
  let tree: any;
  let detailOverride: InventoryMovement | null = null;
  let denied = false;
  const detailUrl = '/inventory/movements/im-1';

  const printAction = () => mockActions.find(item => item.id === 'print');

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLocale = 'en';
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
  afterEach(() => act(() => tree.unmount()));

  it('IM-P16 re-reads the canonical detail at print time and prints the shared document', async () => {
    expect(printAction().enabled).toBe(true);
    expect(printAction().permission).toBe('inventory-movement:read');
    detailOverride = { ...fixture(), notes: 'Notes recorded just before printing.' };
    await act(async () => { await printAction().onClick(); });

    const detailCalls = api.get.mock.calls.filter((call: any[]) => call[0] === detailUrl);
    expect(detailCalls).toHaveLength(2);
    expect(mockOpen).toHaveBeenCalledTimes(1);
    const model = mockOpen.mock.calls[0][0];
    expect(model.mode).toBe('DOCUMENT');
    expect(model.documentNumber).toBe('IM-000230');
    expect(model.company).toBe('Company A');
    expect(model.branch).toBe('Branch A');
    expect(model.printedBy).toBe('Reviewer');
    expect((model.metadata || []).find((field: any) => field.label === mockT('inventoryCounting.warehouse'))?.value).toBe('[WH-JOB-RAW-001] Raw Materials Store');
    expect((model.notes || []).join(' ')).toContain('Notes recorded just before printing.');
  });

  it('IM-P17 opens no document when the print-time read is denied', async () => {
    denied = true;
    await act(async () => { await printAction().onClick(); });
    expect(mockOpen).not.toHaveBeenCalled();
    expect(mockDialog).toHaveBeenCalled();
  });

  it('IM-P19 uses the runtime print timestamp, not the movement date or page load time', async () => {
    await act(async () => { await printAction().onClick(); });
    const model = mockOpen.mock.calls[0][0];
    expect(model.printedAt).toBeInstanceOf(Date);
    expect(model.printedAt.toISOString()).not.toBe(fixture().movementDate);
    expect(model.printedBy).toBe('Reviewer');
    expect(model.timeZone).toBeTruthy();
  });
});
