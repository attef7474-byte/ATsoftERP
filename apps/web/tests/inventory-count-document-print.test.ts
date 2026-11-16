import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { inventoryCountDocumentModel } from '../src/components/print/inventory-count-document-print';
import type { InventoryCountDocumentSource } from '../src/components/print/inventory-count-document-print';
import { PrintDocument } from '../src/components/print/PrintDocument';
import type { InventoryCount, InventoryCountLine } from '../src/lib/admin-types';
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
jest.mock('../src/lib/auth-context', () => ({ useAuth: () => ({ activeContext: { companyId: 'company-a', branchId: 'branch-a', companyName: 'Company A', companyNameEn: 'Company A', companyNameAr: 'Company A', branchName: 'Branch A', branchNameEn: 'Branch A', branchNameAr: 'Branch A' }, archivedContext: null, isArchivedContext: false, contextVersion: 1, contextLoading: false, user: { id: 'reviewer', name: 'Reviewer' }, permissions: { permissions: ['inventory-count:read'] }, isSuperAdmin: false }) }));
jest.mock('../src/components/admin/error-modal', () => ({ useErrorModal: () => ({ showError: mockDialog }) }));
jest.mock('../src/components/admin/error-handler', () => ({ useApiErrorHandler: () => mockDialog }));
jest.mock('../src/components/print/print-runtime', () => ({ openPrintDocument: (...args: any[]) => mockOpen(...args) }));
jest.mock('next/navigation', () => ({ notFound: jest.fn(), useParams: () => ({ id: 'ic-1' }), useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../src/components/admin/admin-action-bar', () => ({
  useRegisterAdminActions: (actions: any[]) => { mockActions = actions; },
  useStableHandlers: (handlers: any) => ({ exec: (name: string) => handlers[name]() }),
  ActionBackIcon: () => null, ActionRefreshIcon: () => null, ActionEditIcon: () => null,
  ActionAddIcon: () => null, ActionDeleteIcon: () => null, ActionPrintIcon: () => null,
  ActionStartIcon: () => null, ActionCompleteIcon: () => null, ActionCancelIcon: () => null,
  ActionGenerateIcon: () => null, ActionViewIcon: () => null,
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

const Page = require('../src/app/admin/inventory/counts/[id]/page').default;
const api = require('../src/lib/api').api;

const TECHNICAL_IDS = [
  'private-count', 'private-line-1', 'private-line-2', 'private-product-1', 'private-product-2',
  'private-company', 'private-branch', 'private-warehouse', 'private-location',
  'private-counter', 'private-verifier', 'private-creator', 'private-starter', 'private-completer',
  'private-request', 'private-balance',
];

function line(overrides: Partial<InventoryCountLine> = {}): InventoryCountLine {
  // The fixture deliberately carries more than the document may print: unit cost,
  // currency, lot/serial fields and user ids exist in related contracts/screens.
  // The adapter must whitelist business fields and ignore the rest.
  return {
    id: 'private-line-1',
    countId: 'private-count',
    productId: 'private-product-1',
    warehouseLocationId: 'private-location',
    systemQty: 25,
    countedQty: 20,
    differenceQty: -5,
    status: 'VERIFIED',
    countedAt: '2026-11-12T09:00:00Z',
    countedById: 'private-counter',
    verifiedAt: '2026-11-12T10:00:00Z',
    verifiedById: 'private-verifier',
    notes: 'First shelf recount.',
    createdAt: '2026-11-12T08:00:00Z',
    updatedAt: '2026-11-12T10:00:00Z',
    product: { id: 'private-product-1', code: 'SP-1001', name: 'Bearing', unit: 'PCS' },
    warehouseLocation: { id: 'private-location', code: 'A-01', name: 'Rack A-01' },
    ...overrides,
    // Extra fields present only to prove the adapter does not print them.
    ...({ unitCost: '48321.75', currencyCode: 'USD', batchNumber: 'LOT-77', serialNumber: 'SN-9' } as any),
  } as InventoryCountLine;
}

function count(overrides: Partial<InventoryCount> = {}): InventoryCount {
  return {
    id: 'private-count',
    countNumber: 'IC-000145',
    companyId: 'private-company',
    branchId: 'private-branch',
    warehouseId: 'private-warehouse',
    status: 'COMPLETED',
    countDate: '2026-11-12T00:00:00Z',
    startedAt: '2026-11-12T07:30:00Z',
    completedAt: '2026-11-12T15:45:00Z',
    cancelledAt: null,
    notes: 'Monthly cycle count of the raw materials store.\nSecond line of the count note.',
    createdAt: '2026-11-11T16:00:00Z',
    updatedAt: '2026-11-12T15:45:00Z',
    company: { id: 'private-company', name: 'Company A' },
    branch: { id: 'private-branch', name: 'Branch A' },
    warehouse: { id: 'private-warehouse', code: 'WH-JOB-RAW-001', name: 'Raw Materials Store' },
    ...overrides,
  };
}

function source(overrides: Partial<InventoryCount> = {}, lines?: InventoryCountLine[]): InventoryCountDocumentSource {
  return {
    count: count(overrides),
    lines: lines ?? [
      // Deliberately unsorted: the document orders by business identity.
      line({
        id: 'private-line-2',
        productId: 'private-product-2',
        systemQty: 4,
        countedQty: 6,
        differenceQty: 2,
        status: 'COUNTED',
        countedById: 'private-counter',
        verifiedAt: null,
        verifiedById: null,
        notes: null,
        product: { id: 'private-product-2', code: 'RM-2002', name: 'Raw material', unit: 'KG' },
        warehouseLocation: { id: 'private-location', code: 'B-02', name: 'Rack B-02' },
      }),
      line(),
    ],
  };
}

function renderDocument(data: InventoryCountDocumentSource, locale: 'en' | 'ar') {
  mockLocale = locale;
  const model = inventoryCountDocumentModel(data, mockT, locale);
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

const forbidden = /private-|lockVersion|companyId|branchId|warehouseId|locationId|productId|countId|countLineId|countedById|verifiedById|createdById|startedById|completedById|cancelledById|unitCost|currencyCode|batchNumber|serialNumber|<button|<input|<select|<nav|NaN|Invalid Date|reports\.printDocument\./;

describe('inventory count business document', () => {
  it.each(['ar', 'en'] as const)('IC-P01/P02/P03/P05/P07/P08 renders the %s document with business identity, context and line UOMs', locale => {
    const { model, html } = renderDocument(source(), locale);

    expect(model.mode).toBe('DOCUMENT');
    expect(model.documentNumber).toBe('IC-000145');
    expect(model.title).toBe(mockT('inventoryCounting.count'));
    expect(model.scopeLabel).toBe(mockT('reports.printDocument.countDocumentScope'));
    expect(model.paperSize).toBe('A4');
    expect(model.orientation).toBe('portrait');
    expect(html).toContain('Company A');
    expect(html).toContain('Branch A');

    expect(model.sections.map(section => section.title)).toEqual([mockT('inventoryCounting.lines')]);
    const keys = model.sections[0].columns.map(column => column.key);
    expect(keys).toEqual(expect.arrayContaining([
      'rowNumber', 'productCode', 'productName', 'unit', 'systemQty', 'countedQty', 'differenceQty', 'lineStatus', 'location',
    ]));

    for (const expected of [
      'IC-000145', '[WH-JOB-RAW-001] Raw Materials Store', 'SP-1001', 'Bearing', 'RM-2002', 'Raw material',
      'PCS', 'KG', '[A-01] Rack A-01', '[B-02] Rack B-02', '25', '20', '4', '6',
      'First shelf recount.',
      'Monthly cycle count of the raw materials store.',
      'Second line of the count note.',
      mockT('reports.printDocument.countDocumentNote'),
    ]) {
      expect(html).toContain(expected);
    }
    expect(html).not.toMatch(forbidden);
  });

  it('IC-P03 refuses to print without the generated business count number', () => {
    const noNumber = source(); noNumber.count = { ...noNumber.count, countNumber: '' };
    expect(() => inventoryCountDocumentModel(noNumber, mockT, 'en')).toThrow('unavailable');
    const missing = source(); (missing.count as any).countNumber = undefined;
    expect(() => inventoryCountDocumentModel(missing, mockT, 'en')).toThrow('unavailable');
  });

  it('IC-P04 prints the canonical count status and canonical line statuses as localized fields', () => {
    for (const locale of ['ar', 'en'] as const) {
      const { model } = renderDocument(source(), locale);
      const fields = model.metadata || [];
      expect(fields.find(field => field.label === mockT('common.status'))?.value).toBe(mockT('status.COMPLETED'));
      const statusColumn = model.sections[0].columns.find(column => column.key === 'lineStatus');
      const rows = model.sections[0].rows;
      const statuses = rows.map(row => statusColumn!.value(row));
      expect(statuses).toEqual([mockT('status.COUNTED'), mockT('status.VERIFIED')]);
    }
  });

  it('IC-P06 prints the readable warehouse and per-line location, never a warehouse or location id', () => {
    const { model, html } = renderDocument(source(), 'en');
    const fields = model.metadata || [];
    expect(fields.filter(field => field.label === mockT('inventoryCounting.warehouse'))).toHaveLength(1);
    expect(fields.find(field => field.label === mockT('inventoryCounting.warehouse'))?.value).toBe('[WH-JOB-RAW-001] Raw Materials Store');
    expect(html).not.toContain('private-warehouse');
    expect(html).not.toContain('private-location');

    // A count without any readable location omits the location column instead of printing ids.
    const withoutLocation = source({}, [line({ warehouseLocation: undefined })]);
    const rendered = renderDocument(withoutLocation, 'en');
    expect(rendered.model.sections[0].columns.map(column => column.key)).not.toContain('location');
    expect(rendered.html).not.toContain('private-location');
  });

  it('IC-P09 prints the stored count-time system quantity snapshot, not a live balance', () => {
    const data = source({}, [line({ systemQty: 25, countedQty: 20, differenceQty: -5 })]);
    // A current-balance projection smuggled into the payload must never appear.
    (data as any).inventoryBalance = { quantity: 9999, id: 'private-balance' };
    (data.lines[0] as any).currentBalanceQty = 9999;
    const { model, html } = renderDocument(data, 'en');
    const systemColumn = model.sections[0].columns.find(column => column.key === 'systemQty');
    expect(systemColumn?.value(model.sections[0].rows[0])).toBe(25);
    expect(html).toContain('25');
    expect(html).not.toContain('9999');
    expect(html).not.toContain('9,999');
    expect(html).not.toContain('private-balance');
  });

  it('IC-P10/P11 keeps the canonical difference value and sign convention and never recalculates it', () => {
    const data = source({}, [
      line({ id: 'private-line-1', systemQty: 25, countedQty: 20, differenceQty: -5, product: { id: 'private-product-1', code: 'SP-1001', name: 'Bearing', unit: 'PCS' } }),
      line({ id: 'private-line-2', systemQty: 4, countedQty: 6, differenceQty: 2, product: { id: 'private-product-2', code: 'RM-2002', name: 'Raw material', unit: 'KG' } }),
    ]);
    // A stale/misleading recomputation hint must not override the stored value.
    (data.lines[0] as any).currentDifferenceQty = 77;
    const { model, html } = renderDocument(data, 'en');
    const differenceColumn = model.sections[0].columns.find(column => column.key === 'differenceQty');
    const differences = model.sections[0].rows.map(row => differenceColumn!.format!(differenceColumn!.value(row)));
    expect(differences).toEqual(['2', '-5']);
    expect(html).toContain('-5');
    expect(html).not.toContain('77');
    expect(mockT('reports.printDocument.countDocumentNote')).toContain('counted quantity minus system quantity');
  });

  it('IC-P12/P16 has no blind-count mode and never prints fields the authorized screen does not show', () => {
    // Source audit: the count contract has no blind/hidden-expected/variance-mask
    // field and the detail screen always shows system/counted/difference.
    const { model, html } = renderDocument(source(), 'en');
    const keys = model.sections[0].columns.map(column => column.key);
    for (const absent of ['expectedQty', 'hiddenQty', 'otherCounterQty', 'blind', 'recountQty', 'lotNumber', 'batchNumber', 'serialNumber', 'unitCost', 'currencyCode', 'lineValue']) {
      expect(keys).not.toContain(absent);
    }
    expect(html).not.toContain('LOT-77');
    expect(html).not.toContain('SN-9');
    expect(html).not.toContain('48321.75');
    expect(html).not.toContain('USD');
  });

  it('IC-P13 has no recount or multiple-pass field in the canonical contract and prints one recorded quantity', () => {
    const { model } = renderDocument(source(), 'en');
    const keys = model.sections[0].columns.map(column => column.key);
    expect(keys).not.toContain('round');
    expect(keys).not.toContain('pass');
    expect(keys).not.toContain('recountQty');
    expect(keys.filter(key => key === 'countedQty')).toHaveLength(1);
  });

  it('IC-P14 omits counter and verifier identities because the contract supplies ids only', () => {
    const { html } = renderDocument(source(), 'en');
    for (const id of ['private-counter', 'private-verifier', 'private-creator', 'private-starter', 'private-completer']) {
      expect(html).not.toContain(id);
    }
    expect(html).not.toContain(mockT('physicalCount.submittedBy'));
    expect(html).not.toContain(mockT('physicalCount.approvedBy'));
  });

  it('IC-P15 never creates one quantity total across mixed or missing units', () => {
    const mixed = source({}, [
      line({ id: 'private-line-1', systemQty: 200000, countedQty: 200000, differenceQty: 0, product: { id: 'private-product-1', code: 'RM-1', name: 'Raw material', unit: 'KG' } }),
      line({ id: 'private-line-2', systemQty: 1000000, countedQty: 1000000, differenceQty: 0, product: { id: 'private-product-2', code: 'PK-2', name: 'Packing roll', unit: 'PCS' } }),
    ]);
    const { model, html } = renderDocument(mixed, 'en');

    expect(model.sections[0].totals).toBeUndefined();
    expect((model.summary || []).map(field => field.label)).toEqual([
      mockT('inventoryCounting.lineCount'),
      mockT('inventoryCounting.countedLinesCount'),
      mockT('inventoryCounting.verifiedLinesCount'),
    ]);
    expect(html).not.toContain('1,200,000');
    expect(html).not.toContain('1200000');
    expect(html).toContain('200,000');
    expect(html).toContain('1,000,000');
  });

  it('IC-P17/P18 redacts internal identifiers, sensitive data and application chrome', () => {
    const { model, html } = renderDocument(source(), 'en');
    for (const id of TECHNICAL_IDS) expect(html).not.toContain(id);
    expect(html).not.toMatch(forbidden);
    expect(html).not.toContain('token');
    expect(html).not.toContain('password');
    // The count number is business identity, not a technical id.
    expect(model.documentNumber).toBe('IC-000145');
  });

  it('IC-P21 renders a localized empty state for a legacy zero-line count', () => {
    const empty = source({ countNumber: 'IC-000146', status: 'DRAFT', startedAt: null, completedAt: null, cancelledAt: null, notes: null, branch: undefined }, []);
    const { model, html } = renderDocument(empty, 'en');
    const metadataValue = (label: string) => (model.metadata || []).find(field => field.label === label)?.value;
    expect(metadataValue(mockT('inventoryCounting.startedAt'))).toBeUndefined();
    expect(metadataValue(mockT('inventoryCounting.completedAt'))).toBeUndefined();
    expect(model.notes).toEqual([mockT('reports.printDocument.countDocumentNote')]);
    expect(model.sections[0].rows).toEqual([]);
    expect(html).toContain(mockT('reports.printDocument.empty'));
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
  });

  it('IC-P22 keeps every count line exactly once in a multipage model', () => {
    const long = source({}, Array.from({ length: 120 }, (_, index) => line({
      id: `private-line-${index + 1}`,
      productId: `private-product-${index + 1}`,
      systemQty: index + 1,
      countedQty: index + 1,
      differenceQty: 0,
      status: 'VERIFIED',
      notes: null,
      product: { id: `private-product-${index + 1}`, code: `ITEM-${String(index + 1).padStart(3, '0')}`, name: `Item ${index + 1}`, unit: index % 2 ? 'KG' : 'PCS' },
      warehouseLocation: { id: `private-location-${index + 1}`, code: `L-${String(index + 1).padStart(3, '0')}`, name: `Location ${index + 1}` },
    })));

    const { model } = renderDocument(long, 'en');
    const rows = model.sections[0].rows;
    expect(rows).toHaveLength(120);
    expect(new Set(rows.map(row => row.lineNumber)).size).toBe(120);
    expect(new Set(rows.map(row => row.line.product?.code)).size).toBe(120);
    expect(rows[0].lineNumber).toBe(1);
    expect(rows[119].lineNumber).toBe(120);
    expect(new Set(rows.map(row => row.line.product?.code))).toEqual(new Set(Array.from({ length: 120 }, (_, index) => `ITEM-${String(index + 1).padStart(3, '0')}`)));
  });

  it('IC-P24 renders the same model values into the printable HTML for Arabic and English', () => {
    for (const locale of ['ar', 'en'] as const) {
      const { model, html } = renderDocument(source(), locale);
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

describe('actual count page through the shared engine', () => {
  let tree: any;
  let documentOverride: InventoryCountDocumentSource | null = null;
  let denied = false;
  const detailUrl = '/inventory/counts/ic-1';
  const documentUrl = '/inventory/counts/ic-1/results';

  const printAction = () => mockActions.find(item => item.id === 'print');

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLocale = 'en';
    documentOverride = null;
    denied = false;
    api.get.mockImplementation((url: string) => {
      if (url === detailUrl) return Promise.resolve(count({ lines: source().lines }));
      if (url === documentUrl) {
        if (denied) return Promise.reject(new Error('Denied'));
        return Promise.resolve(documentOverride || { ...source(), results: { totalLines: 2, countedLines: 2, verifiedLines: 1, totalDifference: -3 } });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    await act(async () => { tree = create(React.createElement(Page)); });
  });
  afterEach(() => act(() => tree.unmount()));

  it('IC-P19 re-reads the canonical count document at print time and prints the shared document', async () => {
    expect(printAction().enabled).toBe(true);
    expect(printAction().permission).toBe('inventory-count:read');
    documentOverride = { ...source(), count: count({ notes: 'Notes recorded just before printing.' }) };
    await act(async () => { await printAction().onClick(); });

    const documentCalls = api.get.mock.calls.filter((call: any[]) => call[0] === documentUrl);
    expect(documentCalls).toHaveLength(1);
    expect(mockOpen).toHaveBeenCalledTimes(1);
    const model = mockOpen.mock.calls[0][0];
    expect(model.mode).toBe('DOCUMENT');
    expect(model.documentNumber).toBe('IC-000145');
    expect(model.company).toBe('Company A');
    expect(model.branch).toBe('Branch A');
    expect(model.printedBy).toBe('Reviewer');
    expect((model.metadata || []).find((field: any) => field.label === mockT('inventoryCounting.warehouse'))?.value).toBe('[WH-JOB-RAW-001] Raw Materials Store');
    expect((model.notes || []).join(' ')).toContain('Notes recorded just before printing.');
  });

  it('IC-P20 opens no document when the print-time read is denied', async () => {
    denied = true;
    await act(async () => { await printAction().onClick(); });
    expect(mockOpen).not.toHaveBeenCalled();
    expect(mockDialog).toHaveBeenCalled();
  });

  it('IC-P23 uses the runtime print timestamp, not the count date or page load time', async () => {
    await act(async () => { await printAction().onClick(); });
    const model = mockOpen.mock.calls[0][0];
    expect(model.printedAt).toBeInstanceOf(Date);
    expect(model.printedAt.toISOString()).not.toBe(count().countDate);
    expect(model.printedBy).toBe('Reviewer');
    expect(model.timeZone).toBeTruthy();
  });

  it('IC-P04 keeps user-facing controls, workflow actions and chrome out of the document', async () => {
    await act(async () => { await printAction().onClick(); });
    const model = mockOpen.mock.calls[0][0];
    const body = renderToStaticMarkup(React.createElement(PrintDocument, { model, t: mockT }));
    expect(body).not.toMatch(/<(button|input|select|nav)\b/);
    expect(body).not.toContain('generateAdjustment');
    expect(body).not.toContain('inventory-count:update');
  });
});
