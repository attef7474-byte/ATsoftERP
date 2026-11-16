import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { inventoryOpeningBalanceDocumentModel } from '../src/components/print/inventory-opening-balance-document-print';
import { PrintDocument } from '../src/components/print/PrintDocument';
import type { OpeningBalance, OpeningBalanceLine } from '../src/lib/admin-types';
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
jest.mock('../src/lib/auth-context', () => ({ useAuth: () => ({ activeContext: { companyId: 'company-a', branchId: 'branch-a', companyName: 'Company A', companyNameEn: 'Company A', companyNameAr: 'Company A', branchName: 'Branch A', branchNameEn: 'Branch A', branchNameAr: 'Branch A' }, archivedContext: null, isArchivedContext: false, contextVersion: 1, contextLoading: false, user: { id: 'reviewer', name: 'Reviewer' }, permissions: { permissions: ['inventory:opening-balance:read'] }, isSuperAdmin: false }) }));
jest.mock('../src/components/admin/error-modal', () => ({ useErrorModal: () => ({ showError: mockDialog }) }));
jest.mock('../src/components/admin/error-handler', () => ({ useApiErrorHandler: () => mockDialog }));
jest.mock('../src/components/print/print-runtime', () => ({ openPrintDocument: (...args: any[]) => mockOpen(...args) }));
jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'ob-1' }), useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../src/components/admin/admin-action-bar', () => ({
  useRegisterAdminActions: (actions: any[]) => { mockActions = actions; },
  useStableHandlers: (handlers: any) => ({ exec: (name: string) => handlers[name]() }),
  ActionBackIcon: () => null, ActionRefreshIcon: () => null, ActionEditIcon: () => null,
  ActionAddIcon: () => null, ActionDeleteIcon: () => null, ActionPrintIcon: () => null,
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

const Page = require('../src/app/admin/inventory/opening-balances/[id]/page').default;
const api = require('../src/lib/api').api;

const TECHNICAL_IDS = [
  'private-ob', 'private-line-1', 'private-line-2', 'private-product-1', 'private-product-2',
  'private-company', 'private-branch', 'private-warehouse', 'private-location',
  'private-header-location', 'private-movement', 'private-submitter', 'private-approver',
  'private-poster', 'private-rejecter', 'private-canceller',
];

function line(overrides: Partial<OpeningBalanceLine> = {}): OpeningBalanceLine {
  return {
    id: 'private-line-1',
    openingBalanceId: 'private-ob',
    productId: 'private-product-1',
    locationId: 'private-location',
    quantity: 200,
    quantityBase: '200',
    unitCost: '12.5',
    currencyCode: 'USD',
    valuationReason: null,
    movementId: 'private-movement',
    notes: 'Line note recorded for the first item.',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-02T09:30:00Z',
    product: { id: 'private-product-1', code: 'FG-1001', name: 'Finished carton', unit: 'KG' },
    ...overrides,
  };
}

function fixture(): OpeningBalance {
  return {
    id: 'private-ob',
    code: 'OB-000035',
    companyId: 'private-company',
    branchId: 'private-branch',
    warehouseId: 'private-warehouse',
    locationId: 'private-header-location',
    status: 'POSTED',
    documentDate: '2026-11-01T00:00:00Z',
    reason: 'Authorized stock initialization for the new warehouse.',
    notes: 'First line of the approved initialization memo.\nSecond line with the controller reference.',
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
        quantity: 1000000,
        quantityBase: '1000000',
        unitCost: null,
        currencyCode: null,
        notes: null,
        product: { id: 'private-product-2', code: 'PK-2002', name: 'Packing roll', unit: 'PCS' },
      }),
    ],
    _count: { lines: 2 },
  };
}

function renderDocument(data: OpeningBalance, locale: 'en' | 'ar') {
  mockLocale = locale;
  const model = inventoryOpeningBalanceDocumentModel(data, mockT, locale);
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

const forbidden = /private-|lockVersion|companyId|branchId|warehouseId|locationId|productId|openingBalanceId|submittedById|approvedById|postedById|rejectedById|cancelledById|movementId|<button|<input|<select|<nav|NaN|Invalid Date|reports\.printDocument\./;

describe('inventory opening balance business document', () => {
  it.each(['ar', 'en'] as const)('OB-P01/P02/P03/P04/P05/P06/P07 renders the %s document with business identity, context, warehouse and line UOMs', locale => {
    const { model, html } = renderDocument(fixture(), locale);

    expect(model.mode).toBe('DOCUMENT');
    expect(model.documentNumber).toBe('OB-000035');
    expect(model.title).toBe(mockT('inventoryCounting.openingBalance'));
    expect(model.scopeLabel).toBe(mockT('reports.printDocument.openingBalanceDocumentScope'));
    expect(model.paperSize).toBe('A4');
    expect(model.orientation).toBe('portrait');
    expect(html).toContain('Company A');
    expect(html).toContain('Branch A');

    const metadataValue = (label: string) => (model.metadata || []).find(field => field.label === label)?.value;
    expect(metadataValue(mockT('common.status'))).toBe(mockT('status.POSTED'));
    expect(metadataValue(mockT('inventoryCounting.warehouse'))).toBe('[WH-JOB-RAW-001] Raw Materials Store');
    expect(metadataValue(mockT('inventoryCounting.documentDate'))).toBeTruthy();
    expect(metadataValue(mockT('inventoryCounting.reason'))).toBe('Authorized stock initialization for the new warehouse.');

    expect(model.sections.map(section => section.title)).toEqual([mockT('inventoryCounting.lines')]);
    expect(model.sections[0].columns.map(column => column.key)).toEqual([
      'rowNumber', 'productCode', 'productName', 'quantity', 'unit', 'unitCost', 'currency', 'lineNotes',
    ]);

    for (const expected of [
      'OB-000035', '[WH-JOB-RAW-001] Raw Materials Store', 'FG-1001', 'Finished carton',
      'PK-2002', 'Packing roll', 'KG', 'PCS', '12.5', 'USD', '200',
      'Line note recorded for the first item.',
      'First line of the approved initialization memo.',
      'Second line with the controller reference.',
      mockT('reports.printDocument.openingBalanceDocumentNote'),
    ]) {
      expect(html).toContain(expected);
    }
    expect(html).not.toMatch(forbidden);
  });

  it('OB-P03 refuses to print without the generated business number', () => {
    const noNumber = fixture(); noNumber.code = '';
    expect(() => inventoryOpeningBalanceDocumentModel(noNumber, mockT, 'en')).toThrow('unavailable');
    const missing = fixture(); (missing as any).code = undefined;
    expect(() => inventoryOpeningBalanceDocumentModel(missing, mockT, 'en')).toThrow('unavailable');
  });

  it('OB-P08 never creates one quantity total across mixed or missing units', () => {
    const mixed = fixture();
    mixed.lines = [
      line({ id: 'private-line-1', quantity: 200000, unitCost: null, currencyCode: null, product: { id: 'private-product-1', code: 'RM-1', name: 'Raw material', unit: 'KG' } }),
      line({ id: 'private-line-2', quantity: 1000000, unitCost: null, currencyCode: null, product: { id: 'private-product-2', code: 'PK-2', name: 'Packing roll', unit: 'PCS' } }),
    ];
    const { model, html } = renderDocument(mixed, 'en');

    expect(model.sections[0].totals).toBeUndefined();
    expect((model.summary || []).map(field => field.label)).toEqual([mockT('inventoryCounting.lineCount')]);
    expect(html).not.toContain('1,200,000');
    expect(html).not.toContain('1200000');
    expect(html).toContain('200,000');
    expect(html).toContain('1,000,000');
  });

  it('OB-P09 omits location and lot columns because the canonical detail returns no readable name', () => {
    const { model, html } = renderDocument(fixture(), 'en');
    const keys = model.sections[0].columns.map(column => column.key);
    expect(keys).not.toContain('location');
    expect(keys).not.toContain('lot');
    expect(keys).not.toContain('batch');
    const thead = html.match(/<thead>[\s\S]*?<\/thead>/)?.[0] || '';
    expect(thead).not.toContain(`>${mockT('inventoryCounting.warehouseLocation')}<`);
    expect(html).not.toContain('private-location');
    expect(html).not.toContain('private-header-location');
  });

  it('OB-P10 prints unit cost and currency only when recorded and never computes a line value or document total', () => {
    const withCosts = renderDocument(fixture(), 'en');
    expect(withCosts.model.sections[0].columns.map(column => column.key)).toContain('unitCost');
    expect(withCosts.model.sections[0].columns.map(column => column.key)).toContain('currency');
    expect(withCosts.html).toContain('12.5');
    expect(withCosts.html).toContain('USD');

    const withoutCosts = fixture();
    withoutCosts.lines = (withoutCosts.lines || []).map(item => ({ ...item, unitCost: null, currencyCode: null }));
    const rendered = renderDocument(withoutCosts, 'en');
    const keys = rendered.model.sections[0].columns.map(column => column.key);
    expect(keys).not.toContain('unitCost');
    expect(keys).not.toContain('currency');
    expect(keys).not.toContain('lineValue');
    expect(keys).not.toContain('totalValue');
    expect(rendered.html).not.toContain('12.5');
    expect(rendered.html).not.toContain('USD');
  });

  it('OB-P11/P12 redacts internal identifiers, sensitive data and application chrome', () => {
    const { html } = renderDocument(fixture(), 'en');
    for (const id of TECHNICAL_IDS) expect(html).not.toContain(id);
    expect(html).not.toMatch(forbidden);
    expect(html).not.toContain('token');
    expect(html).not.toContain('password');
  });

  it('OB-P15 omits empty optional fields and renders a localized empty state for zero lines', () => {
    const minimal = fixture();
    minimal.reason = '';
    minimal.notes = null;
    minimal.postedAt = null;
    minimal.submittedAt = null;
    minimal.approvedAt = null;
    minimal.branch = undefined;
    minimal.lines = [];

    const { model, html } = renderDocument(minimal, 'en');
    const metadataValue = (label: string) => (model.metadata || []).find(field => field.label === label)?.value;
    expect(metadataValue(mockT('inventoryCounting.reason'))).toBe('');
    expect(metadataValue(mockT('inventoryCounting.postedAt'))).toBeUndefined();
    expect(model.notes).toEqual([mockT('reports.printDocument.openingBalanceDocumentNote')]);
    expect(model.sections[0].rows).toEqual([]);
    expect(html).toContain(mockT('reports.printDocument.empty'));
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
  });

  it('OB-P16 keeps every line exactly once in a multipage model', () => {
    const long = fixture();
    long.lines = Array.from({ length: 120 }, (_, index) => line({
      id: `private-line-${index + 1}`,
      productId: `private-product-${index + 1}`,
      quantity: index + 1,
      unitCost: null,
      currencyCode: null,
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

  it('OB-P17 renders the same model values into the printable HTML for Arabic and English', () => {
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

describe('actual opening balance page through the shared engine', () => {
  let tree: any;
  let detailOverride: OpeningBalance | null = null;
  let denied = false;
  const detailUrl = '/inventory/opening-balances/ob-1';

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

  it('OB-P13 re-reads the canonical detail at print time and prints the shared document', async () => {
    expect(printAction().enabled).toBe(true);
    expect(printAction().permission).toBe('inventory:opening-balance:read');
    detailOverride = { ...fixture(), reason: 'Reason recorded just before printing.' };
    await act(async () => { await printAction().onClick(); });

    const detailCalls = api.get.mock.calls.filter((call: any[]) => call[0] === detailUrl);
    expect(detailCalls).toHaveLength(2);
    expect(mockOpen).toHaveBeenCalledTimes(1);
    const model = mockOpen.mock.calls[0][0];
    expect(model.mode).toBe('DOCUMENT');
    expect(model.documentNumber).toBe('OB-000035');
    expect(model.company).toBe('Company A');
    expect(model.branch).toBe('Branch A');
    expect(model.printedBy).toBe('Reviewer');
    expect((model.metadata || []).find((field: any) => field.label === mockT('inventoryCounting.reason'))?.value).toBe('Reason recorded just before printing.');
  });

  it('OB-P14 opens no document when the print-time read is denied', async () => {
    denied = true;
    await act(async () => { await printAction().onClick(); });
    expect(mockOpen).not.toHaveBeenCalled();
    expect(mockDialog).toHaveBeenCalled();
  });

  it('OB-P18 uses the runtime print timestamp, not the document date or page load time', async () => {
    await act(async () => { await printAction().onClick(); });
    const model = mockOpen.mock.calls[0][0];
    expect(model.printedAt).toBeInstanceOf(Date);
    expect(model.printedAt.toISOString()).not.toBe(fixture().documentDate);
    expect(model.printedBy).toBe('Reviewer');
    expect(model.timeZone).toBeTruthy();
  });
});
