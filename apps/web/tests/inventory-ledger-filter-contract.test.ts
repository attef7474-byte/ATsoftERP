import React from 'react';
import en from '../src/lib/i18n/locales/en';

const { act, create } = require('react-test-renderer');

const mockT = (key: string): string => {
  const value = key.split('.').reduce<any>((node, part) => node?.[part], en);
  if (typeof value !== 'string') throw new Error(`Missing ${key}`);
  return value;
};

const mockApiGet = jest.fn();
let mockLookups: any[] = [];
let mockGridProps: any = null;

jest.mock('../src/lib/i18n/use-translation', () => ({
  useTranslation: () => ({ t: mockT, locale: 'en', dir: 'ltr' }),
}));
jest.mock('../src/components/admin/admin-action-bar', () => ({
  useRegisterAdminActions: jest.fn(),
  useStableHandlers: (handlers: any) => ({ exec: (name: string) => handlers[name]() }),
  ActionRefreshIcon: () => null,
  ActionPrintIcon: () => null,
}));
const mockPrintCapture = jest.fn();
const mockPrintInvalidate = jest.fn();
const mockPrintRememberLookup = jest.fn();
const mockPrintSnapshot = jest.fn();
jest.mock('../src/components/print/use-report-print-snapshot', () => ({
  // Stable identities mirror the real hook's useCallback contract; a fresh
  // object per render would make every fetchData dependency change forever.
  useReportPrintSnapshot: () => ({
    capture: mockPrintCapture,
    invalidate: mockPrintInvalidate,
    rememberLookup: mockPrintRememberLookup,
    printSnapshot: mockPrintSnapshot,
    canPrint: false,
  }),
}));
jest.mock('../src/lib/print', () => ({ collectPrintRows: jest.fn() }));
jest.mock('../src/components/print/inventory-ledger-register-print', () => ({
  inventoryLedgerPrintModel: jest.fn(),
}));
jest.mock('../src/components/f9', () => ({
  F9Lookup: (props: any) => {
    mockLookups.push(props);
    return React.createElement('input', {
      'data-f9': props.adapter?.name,
      value: props.value,
      onChange: (valueOrEvent: any) =>
        props.onChange(typeof valueOrEvent === 'string' ? valueOrEvent : valueOrEvent.target.value),
    });
  },
  warehouseAdapter: { name: 'warehouse' },
  productAdapter: { name: 'product' },
}));
jest.mock('../src/components/admin/ui', () => ({
  Button: ({ children, ...props }: any) => React.createElement('button', props, children),
  Card: ({ children }: any) => React.createElement('div', null, children),
  Input: (props: any) =>
    React.createElement('input', {
      'data-label': props.label,
      type: props.type,
      value: props.value,
      placeholder: props.placeholder,
      onChange: props.onChange,
    }),
  Select: (props: any) =>
    React.createElement(
      'select',
      { 'data-label': props.label, value: props.value, onChange: props.onChange },
      (props.options || []).map((option: any) =>
        React.createElement('option', { key: option.value, value: option.value }, option.label),
      ),
    ),
  Pagination: ({ page, totalPages, onPageChange }: any) =>
    React.createElement(
      'button',
      { 'data-pagination': true, 'data-total-pages': totalPages, onClick: () => onPageChange(page + 1) },
      'next',
    ),
  PageHeader: ({ title }: any) => React.createElement('h1', null, title),
  LoadingState: () => null,
}));
jest.mock('../src/components/admin/admin-data-grid', () => ({
  AdminDataGrid: (props: any) => {
    mockGridProps = props;
    return React.createElement('div', { 'data-grid': true });
  },
}));
jest.mock('../src/lib/api', () => ({ api: { get: (...args: any[]) => mockApiGet(...args) } }));

import {
  buildLedgerQueryParams,
  createEmptyLedgerFilters,
  normalizeLedgerFilters,
  type LedgerFilterDraft,
} from '../src/app/admin/inventory/ledger/filter-contract';

const Page = require('../src/app/admin/inventory/ledger/page').default;

const filter = (overrides: Partial<LedgerFilterDraft> = {}): LedgerFilterDraft => ({
  ...createEmptyLedgerFilters(),
  ...overrides,
});

const renderPage = async () => {
  let tree: any;
  await act(async () => {
    tree = create(React.createElement(Page));
  });
  return tree;
};

const lastParams = () => {
  const calls = mockApiGet.mock.calls;
  return calls[calls.length - 1][1].params;
};
const buttonByLabel = (tree: any, label: string) =>
  tree.root.findAllByType('button').find((button: any) => button.props.children === label);
const inputByLabel = (tree: any, label: string) =>
  tree.root.findAll((node: any) => node.type === 'input' && node.props['data-label'] === label)[0];
const f9ByAdapter = (tree: any, adapter: string) =>
  tree.root.findAll((node: any) => node.type === 'input' && node.props['data-f9'] === adapter)[0];
const selectByLabel = (tree: any, label: string) =>
  tree.root.findAll((node: any) => node.type === 'select' && node.props['data-label'] === label)[0];

describe('ledger filter contract — query mapping', () => {
  it('ILH-W01 sends only page and limit by default', () => {
    expect(buildLedgerQueryParams(createEmptyLedgerFilters(), 1)).toEqual({ page: 1, limit: 20 });
  });

  it('ILH-W02 maps the warehouse selection to warehouseId', () => {
    expect(normalizeLedgerFilters(filter({ warehouseId: 'wh1' }))).toEqual({ warehouseId: 'wh1' });
  });

  it('ILH-W03 maps the product selection to productId', () => {
    expect(normalizeLedgerFilters(filter({ productId: 'prd1' }))).toEqual({ productId: 'prd1' });
  });

  it('ILH-W04 maps the movement type selection', () => {
    expect(normalizeLedgerFilters(filter({ movementType: 'PURCHASE_RECEIPT' }))).toEqual({
      movementType: 'PURCHASE_RECEIPT',
    });
  });

  it('ILH-W05 sends status and never countStatus', () => {
    const normalized = normalizeLedgerFilters(filter({ status: 'POSTED' }));
    expect(normalized.status).toBe('POSTED');
    expect(normalized).not.toHaveProperty('countStatus');
    expect(buildLedgerQueryParams(filter({ status: 'POSTED' }), 1)).not.toHaveProperty('countStatus');
  });

  it('ILH-W06 maps the direction selection', () => {
    expect(normalizeLedgerFilters(filter({ direction: 'OUT' }))).toEqual({ direction: 'OUT' });
  });

  it('ILH-W07 maps the source type selection', () => {
    expect(normalizeLedgerFilters(filter({ sourceType: 'MANUAL' }))).toEqual({ sourceType: 'MANUAL' });
  });

  it('ILH-W08 maps dateFrom and dateTo as date-only values', () => {
    expect(normalizeLedgerFilters(filter({ dateFrom: '2026-11-01', dateTo: '2026-11-13' }))).toEqual({
      dateFrom: '2026-11-01',
      dateTo: '2026-11-13',
    });
  });

  it('ILH-W09 trims and maps the search text', () => {
    expect(normalizeLedgerFilters(filter({ search: '  IM-001  ' }))).toEqual({ search: 'IM-001' });
    expect(normalizeLedgerFilters(filter({ search: '   ' }))).toEqual({});
  });

  it('ILH-W10 never sends companyId or branchId, even from a hostile draft', () => {
    const hostile = { ...filter({ warehouseId: 'wh1' }), companyId: 'c2', branchId: 'b2' } as any;
    const params = buildLedgerQueryParams(hostile, 1);
    expect(params).not.toHaveProperty('companyId');
    expect(params).not.toHaveProperty('branchId');
    expect(params.warehouseId).toBe('wh1');
  });

  it('ILH-W11 never sends display labels or unknown UI fields', () => {
    const hostile = {
      ...filter({ warehouseId: 'wh1' }),
      warehouseName: 'Main Warehouse',
      warehouseLabel: '[WH1] Main Warehouse',
      sourceId: 'raw-source',
      locationId: 'raw-location',
    } as any;
    const params = buildLedgerQueryParams(hostile, 1);
    expect(Object.keys(params).sort()).toEqual(['limit', 'page', 'warehouseId']);
    expect(params).not.toHaveProperty('sourceId');
    expect(params).not.toHaveProperty('locationId');
  });

  it('omits empty selections and normalizes an invalid page', () => {
    expect(buildLedgerQueryParams(filter({ status: '', movementType: '' }), 0)).toEqual({ page: 1, limit: 20 });
  });
});

describe('ledger page — apply, reset and pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLookups = [];
    mockGridProps = null;
    mockApiGet.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 2 },
    });
  });

  it('ILH-W12 applies the draft filters and resets the page to 1', async () => {
    const tree = await renderPage();
    const pagination = tree.root.findAll((node: any) => node.props['data-pagination'])[0];
    await act(async () => {
      pagination.props.onClick();
    });
    expect(lastParams().page).toBe(2);

    await act(async () => {
      inputByLabel(tree, 'Search').props.onChange({ target: { value: 'IM-777' } });
      f9ByAdapter(tree, 'warehouse').props.onChange('wh1');
      f9ByAdapter(tree, 'product').props.onChange('prd1');
      selectByLabel(tree, 'Status').props.onChange({ target: { value: 'POSTED' } });
      selectByLabel(tree, 'Direction').props.onChange({ target: { value: 'IN' } });
      selectByLabel(tree, 'Movement Type').props.onChange({ target: { value: 'MANUAL' } });
      selectByLabel(tree, 'Source Type').props.onChange({ target: { value: 'MANUAL' } });
      inputByLabel(tree, 'Date From').props.onChange({ target: { value: '2026-11-01' } });
      inputByLabel(tree, 'Date To').props.onChange({ target: { value: '2026-11-13' } });
    });
    await act(async () => {
      buttonByLabel(tree, 'Apply').props.onClick();
    });

    expect(lastParams()).toEqual({
      page: 1,
      limit: 20,
      search: 'IM-777',
      warehouseId: 'wh1',
      productId: 'prd1',
      status: 'POSTED',
      direction: 'IN',
      movementType: 'MANUAL',
      sourceType: 'MANUAL',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-13',
    });
    expect(lastParams()).not.toHaveProperty('countStatus');
  });

  it('ILH-W13 resets every optional filter and returns to page 1', async () => {
    const tree = await renderPage();
    await act(async () => {
      f9ByAdapter(tree, 'warehouse').props.onChange('wh1');
      selectByLabel(tree, 'Status').props.onChange({ target: { value: 'POSTED' } });
      inputByLabel(tree, 'Search').props.onChange({ target: { value: 'IM-1' } });
    });
    await act(async () => {
      buttonByLabel(tree, 'Apply').props.onClick();
    });
    expect(lastParams().warehouseId).toBe('wh1');

    await act(async () => {
      buttonByLabel(tree, 'Reset').props.onClick();
    });
    expect(lastParams()).toEqual({ page: 1, limit: 20 });
  });

  it('ILH-W14 preserves applied filters while paginating', async () => {
    const tree = await renderPage();
    await act(async () => {
      f9ByAdapter(tree, 'warehouse').props.onChange('wh1');
      selectByLabel(tree, 'Status').props.onChange({ target: { value: 'POSTED' } });
    });
    await act(async () => {
      buttonByLabel(tree, 'Apply').props.onClick();
    });
    const pagination = tree.root.findAll((node: any) => node.props['data-pagination'])[0];
    await act(async () => {
      pagination.props.onClick();
    });

    expect(lastParams()).toEqual({
      page: 2,
      limit: 20,
      warehouseId: 'wh1',
      status: 'POSTED',
    });
  });

  it('ILH-W15 renders readable lookup values without raw identifiers', async () => {
    const tree = await renderPage();

    expect([...new Set(mockLookups.map((lookup) => lookup.adapter.name))].sort()).toEqual([
      'product',
      'warehouse',
    ]);
    expect(mockLookups.map((lookup) => lookup.adapter.name)).not.toContain('warehouseLocation');
    expect(tree.root.findAll((node: any) => node.props['data-label'] === 'Source ID')).toHaveLength(0);

    const warehouseColumn = mockGridProps.columns.find((column: any) => column.key === 'warehouse');
    expect(warehouseColumn.render({ warehouse: { code: 'WH1', name: 'Main Warehouse' } })).toBe(
      '[WH1] Main Warehouse',
    );

    const movementTypeColumn = mockGridProps.columns.find((column: any) => column.key === 'movementType');
    expect(movementTypeColumn.render({ movementType: 'MANUAL' })).toBe('Manual');

    const statusColumn = mockGridProps.columns.find((column: any) => column.key === 'status');
    expect(statusColumn.render({ status: 'POSTED' })).toBe('Posted');
  });
});
