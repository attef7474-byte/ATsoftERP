import React from 'react';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';

const { act, create } = require('react-test-renderer');
let mockLocale = 'en';
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockError = jest.fn();
const mockToast = jest.fn();
let mockCapabilities: any;
const mockAuth = { permissions: { permissions: [] }, isSuperAdmin: false };
let mockContext = 1;

const mockT = (key: string): string => {
  const value = key.split('.').reduce<any>((node, part) => node?.[part], mockLocale === 'en' ? en : ar);
  if (typeof value !== 'string') throw new Error(`Missing translation ${key}`);
  return value;
};

jest.mock('../src/lib/i18n/use-translation', () => ({
  useTranslation: () => ({ t: mockT, dir: mockLocale === 'ar' ? 'rtl' : 'ltr', locale: mockLocale }),
}));
jest.mock('../src/lib/auth-context', () => ({
  useAuth: () => mockAuth,
  useOperationalContext: () => ({ contextVersion: mockContext, activeContext: null }),
}));
jest.mock('../src/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    patch: (...args: any[]) => mockPatch(...args),
  },
}));
jest.mock('../src/components/admin/error-handler', () => ({ useApiErrorHandler: () => mockError }));
jest.mock('../src/components/admin/toast-provider', () => ({ useToast: () => ({ showToast: mockToast }) }));
jest.mock('../src/components/admin/admin-action-bar', () => ({
  useRegisterAdminActions: () => undefined,
  useStableHandlers: (handlers: any) => ({ exec: (name: string) => handlers[name]() }),
  ActionAddIcon: () => null,
  ActionRefreshIcon: () => null,
}));
jest.mock('../src/components/admin/ui', () => ({
  Button: ({ children, loading, ...props }: any) => React.createElement('button', { ...props, disabled: props.disabled || loading }, children),
  Input: ({ label, error, description, ...props }: any) => React.createElement('input', { ...props, 'data-label': label }),
  Textarea: ({ label, error, description, ...props }: any) => React.createElement('textarea', { ...props, 'data-label': label }),
  Select: ({ label, options, placeholder, error, ...props }: any) => React.createElement('select', { ...props, 'data-label': label },
    React.createElement('option', { value: '' }, placeholder || label),
    ...(options || []).map((option: any) => React.createElement('option', { key: option.value, value: option.value }, option.label)),
  ),
  Modal: ({ open, title, children }: any) => open ? React.createElement('section', { role: 'dialog', 'data-title': title }, children) : null,
  ConfirmDialog: ({ open, onConfirm, onClose, title, children }: any) => open
    ? React.createElement('section', { 'data-confirm': title }, React.createElement('button', { onClick: onConfirm }, 'CONFIRM'), React.createElement('button', { onClick: onClose }, 'KEEP'), children)
    : null,
  Pagination: () => null,
}));
jest.mock('../src/components/f9/F9Lookup', () => ({ F9Lookup: (props: any) => React.createElement('lookup', props) }));
jest.mock('../src/components/f9/F9MultiLookup', () => ({ F9MultiLookup: (props: any) => React.createElement('multi-lookup', props) }));
jest.mock('../src/components/factory/ProductUomSelect', () => ({ ProductUomSelect: (props: any) => React.createElement('product-uom', props) }));
jest.mock('../src/components/admin/admin-data-grid', () => ({
  AdminDataGrid: (props: any) => React.createElement('grid', { 'data-row-count': props.data?.length || 0 }),
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => React.createElement('a', props, children),
}));

import {
  changeProductionOrder,
  changeReceiptSource,
  changeReceiptType,
  changeReceiptWarehouse,
  createEmptyReceiptLine,
  emptyReceiptVoucher,
  formFromReceipt,
  itemTypeForReceiptType,
  nativeReceiptPath,
  receiptAuthorityFor,
  receiptEndpoint,
  receiptPayload,
  RECEIPT_TYPES,
  receiptTypeLabelKey,
  ReceiptType,
} from '../src/components/inventory/receipt-voucher-form';
import { ReceiptVoucherDialog } from '../src/components/inventory/receipt-voucher-dialog';
import { ReceiptVouchersPanel } from '../src/components/inventory/receipt-vouchers-panel';
import { isSidebarItemVisible, sidebarGroups } from '../src/components/admin/shell/navigation-data';

function findNavItem(groups: any[], id: string): any {
  for (const group of groups) {
    for (const item of group.items || []) {
      if (item.id === id) return item;
      for (const section of item.children || []) {
        const nested = (section.items || []).find((candidate: any) => candidate.id === id);
        if (nested) return nested;
      }
    }
    for (const section of group.children || []) {
      const nested = (section.items || []).find((candidate: any) => candidate.id === id);
      if (nested) return nested;
    }
  }
  return null;
}

function collectNodes(node: any, type: string): any[] {
  if (!node) return [];
  const result: any[] = node.type === type ? [node] : [];
  for (const child of node.children || []) result.push(...collectNodes(child, type));
  return result;
}

async function renderPanel() {
  let tree: any;
  await act(async () => {
    tree = create(React.createElement(ReceiptVouchersPanel));
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
    await Promise.resolve();
    await Promise.resolve();
  });
  return tree;
}

function operationalForm() {
  const form = changeReceiptType(emptyReceiptVoucher(), 'RAW_MATERIAL');
  return {
    ...form,
    warehouseId: 'wh-1',
    locationId: 'loc-1',
    receiptSource: 'SUPPLIER' as const,
    supplierName: 'Acme',
    supplierDoc: 'INV-1',
    reason: 'استلام مواد خام',
    notes: 'notes',
    lines: [{ ...form.lines[0], productId: 'prd-1', quantity: '3', notes: 'line' }],
  };
}

function finishedGoodsForm() {
  const form = changeReceiptType(emptyReceiptVoucher(), 'FINISHED_GOOD');
  return {
    ...form,
    warehouseId: 'wh-fg',
    productionOrderId: 'order-1',
    productionRunId: 'run-1',
    documentDate: '2026-11-20',
    lines: [{
      ...form.lines[0],
      productId: 'prd-fg',
      quantity: '7',
      unit: 'PCS',
      productUomId: 'uom-1',
      warehouseLocationId: 'loc-fg',
      batchNumber: 'B-1',
      serialNumber: 'S-1',
      expiryDate: '2027-01-01',
    }],
  };
}

describe('Unified receipt voucher form model', () => {
  it('contains the six exact receipt types and their Arabic labels', () => {
    mockLocale = 'ar';
    expect(RECEIPT_TYPES).toEqual([
      'RAW_MATERIAL', 'SPARE_PART', 'FINISHED_GOOD',
      'PACKAGING_MATERIAL', 'CONSUMABLE', 'GENERAL',
    ]);
    expect(RECEIPT_TYPES.map((type) => mockT(receiptTypeLabelKey(type)))).toEqual([
      'مواد خام', 'قطع غيار', 'منتج تام', 'مواد تعبئة وتغليف', 'مستهلكات', 'أصناف عامة',
    ]);
  });

  it('maps every type to exactly one native authority and endpoint', () => {
    expect(RECEIPT_TYPES.map(receiptAuthorityFor)).toEqual([
      'OPERATIONAL', 'OPERATIONAL', 'PRODUCTION_FG',
      'OPERATIONAL', 'OPERATIONAL', 'OPERATIONAL',
    ]);
    expect(receiptEndpoint('FINISHED_GOOD')).toBe('/production/finished-goods-receipts');
    expect(receiptEndpoint('RAW_MATERIAL')).toBe('/inventory/operational-receipts');
    expect(nativeReceiptPath('SPARE_PART', 'r1')).toBe('/inventory/operational-receipts/r1');
    expect(RECEIPT_TYPES.map(itemTypeForReceiptType)).toEqual(RECEIPT_TYPES);
  });

  it('clears downstream state when the first field changes', () => {
    const changed = changeReceiptType(operationalForm(), 'FINISHED_GOOD');
    expect(changed).toMatchObject({ receiptType: 'FINISHED_GOOD' });
    expect(changed.warehouseId).toBe('');
    expect(changed.locationId).toBe('');
    expect(changed.productionOrderId).toBe('');
    expect(changed.productionRunId).toBe('');
    expect(changed.receiptSource).toBe('');
    expect(changed.supplierName).toBe('');
    expect(changed.reason).toBe('');
    expect(changed.lines).toHaveLength(1);
    expect(changed.lines[0].productId).toBe('');
  });

  it('clears locations and lines when warehouse changes, and runs and lines when order changes', () => {
    const whChanged = changeReceiptWarehouse(operationalForm(), 'wh-2');
    expect(whChanged.locationId).toBe('');
    expect(whChanged.lines[0].productId).toBe('');

    const orderChanged = changeProductionOrder(finishedGoodsForm(), 'order-2');
    expect(orderChanged.productionRunId).toBe('');
    expect(orderChanged.lines[0].productId).toBe('');

    const sourceChanged = changeReceiptSource(operationalForm(), 'RETURN');
    expect(sourceChanged.supplierName).toBe('');
    expect(sourceChanged.supplierDoc).toBe('');
  });

  it('builds the operational DTO only with fields its authority accepts', () => {
    const payload: any = receiptPayload(operationalForm());
    expect(payload).toMatchObject({
      warehouseId: 'wh-1',
      locationId: 'loc-1',
      reason: 'استلام مواد خام',
      receiptType: 'RAW_MATERIAL',
      receiptSource: 'SUPPLIER',
      supplierName: 'Acme',
      supplierDoc: 'INV-1',
    });
    expect(payload.lines).toEqual([{ productId: 'prd-1', quantity: 3, notes: 'line' }]);
    expect(payload.requestId).toBeUndefined();
    expect(payload.productionOrderId).toBeUndefined();
    expect(payload.lines[0].batchNumber).toBeUndefined();
    expect(payload.lines[0].serialNumber).toBeUndefined();
    expect(payload.lines[0].expiryDate).toBeUndefined();
    expect(payload.lines[0].unit).toBeUndefined();
  });

  it('builds the finished-goods DTO with production order, run, UOM and stock identity', () => {
    const payload: any = receiptPayload(finishedGoodsForm());
    expect(payload).toMatchObject({
      productionOrderId: 'order-1',
      productionRunId: 'run-1',
      receiptWarehouseId: 'wh-fg',
      receiptDate: '2026-11-20',
    });
    expect(payload.requestId).toEqual(expect.any(String));
    expect(payload.lines[0]).toMatchObject({
      productId: 'prd-fg',
      quantity: 7,
      unit: 'PCS',
      productUomId: 'uom-1',
      warehouseLocationId: 'loc-fg',
      batchNumber: 'B-1',
      serialNumber: 'S-1',
      expiryDate: '2027-01-01',
    });
    expect(payload.receiptType).toBeUndefined();
  });

  it('omits create-only fields from finished-goods edit payloads', () => {
    const payload: any = receiptPayload(finishedGoodsForm(), true);
    expect(payload.requestId).toBeUndefined();
    expect(payload.productionOrderId).toBeUndefined();
    expect(payload.productionRunId).toBeUndefined();
    expect(payload.receiptWarehouseId).toBeUndefined();
    expect(payload.lines).toHaveLength(1);
  });

  it('loads the same record into the editable form', () => {
    const record = {
      ...finishedGoodsForm(),
      authority: 'PRODUCTION_FG',
      lines: [{ id: 'line-1', productId: 'prd-fg', quantity: 7, unit: 'PCS', batchNumber: 'B-1' }],
    };
    const restored = formFromReceipt(record);
    expect(restored.receiptType).toBe('FINISHED_GOOD');
    expect(restored.warehouseId).toBe('wh-fg');
    expect(restored.productionOrderId).toBe('order-1');
    expect(restored.productionRunId).toBe('run-1');
    expect(restored.lines[0]).toMatchObject({ productId: 'prd-fg', quantity: '7', unit: 'PCS', batchNumber: 'B-1' });
  });
});

describe('Unified receipt voucher UI', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocale = 'en';
    mockCapabilities = {
      canRead: { operational: true, productionFinishedGoods: true },
      canWrite: {
        operational: { create: true, update: true, submit: true, approve: true, reject: true, post: true, cancel: true },
        productionFinishedGoods: { create: true, update: true, post: true, cancel: true, reverse: true },
      },
      receiptTypes: RECEIPT_TYPES,
    };
    mockGet.mockImplementation(async (path: string) => {
      if (path.endsWith('/capabilities')) return mockCapabilities;
      return {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
    });
  });

  it('renders the receipt type first with all six exact Arabic labels', async () => {
    mockLocale = 'ar';
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ReceiptVoucherDialog, {
        form: { ...emptyReceiptVoucher(), receiptType: 'RAW_MATERIAL' },
        onChange: () => undefined,
        types: RECEIPT_TYPES,
        edit: false,
        saving: false,
        onSave: async () => undefined,
        onClose: () => undefined,
      }));
    });
    const selects = collectNodes(tree.toJSON(), 'select');
    expect(selects[0].props['data-label']).toBe('نوع الاستلام');
    const options = (selects[0].children || []).map((option: any) => option.children.join(''));
    expect(options).toEqual([
      'اختر...',
      'مواد خام', 'قطع غيار', 'منتج تام', 'مواد تعبئة وتغليف', 'مستهلكات', 'أصناف عامة',
    ]);
    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain('receiptVoucher.');
  });

  it('hides the panel content from a user with neither native read permission', async () => {
    jest.useFakeTimers();
    mockCapabilities = {
      ...mockCapabilities,
      canRead: { operational: false, productionFinishedGoods: false },
    };
    const tree = await renderPanel();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain(mockT('inventory.receiptVoucher.noReadPermission'));
    expect(json).not.toContain('"data-row-count"');
    await act(async () => { tree.unmount(); });
  });

  it('shows the unified list to a user with only the production read key', async () => {
    jest.useFakeTimers();
    mockCapabilities = {
      ...mockCapabilities,
      canRead: { operational: false, productionFinishedGoods: true },
    };
    const tree = await renderPanel();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('"data-row-count":0');
    expect(json).not.toContain('inventory.receiptVoucher.noReadPermission');
    await act(async () => { tree.unmount(); });
  });
});

describe('Receipt Voucher navigation visibility', () => {
  const item = findNavItem(sidebarGroups as any[], 'inv-receipts');

  it('is registered with the exact canonical route and any-of native read keys', () => {
    expect(item).not.toBeNull();
    expect(item.route).toBe('/admin/inventory/receipts');
    expect(item.permissions).toEqual([
      'inventory:operational-receipt:read',
      'production-finished-goods-receipt:read',
    ]);
  });

  it('uses OR semantics and never broadens access to unrelated roles', () => {
    expect(isSidebarItemVisible(item, ['inventory:operational-receipt:read'], false)).toBe(true);
    expect(isSidebarItemVisible(item, ['production-finished-goods-receipt:read'], false)).toBe(true);
    expect(isSidebarItemVisible(item, ['inventory:read'], false)).toBe(false);
    expect(isSidebarItemVisible(item, null, false)).toBe(false);
    expect(isSidebarItemVisible(item, [], true)).toBe(true);
  });
});
