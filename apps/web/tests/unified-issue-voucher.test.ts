import React, { useState } from 'react';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
const {
  act,
  create
} = require('react-test-renderer');
let mockLocale = 'en';
const mockGet = jest.fn(),
  mockPost = jest.fn(),
  mockPatch = jest.fn(),
  mockError = jest.fn(),
  mockToast = jest.fn();
let mockActions: any[] = [];
let mockAuth: any;
let mockContext = 1;
const mockT = (key: string): string => {
  const value = key.split('.').reduce<any>((node, part) => node?.[part], mockLocale === 'en' ? en : ar);
  if (typeof value !== 'string') throw new Error(`Missing translation ${key}`);
  return value;
};
jest.mock('../src/lib/i18n/use-translation', () => ({
  useTranslation: () => ({
    t: mockT,
    dir: mockLocale === 'ar' ? 'rtl' : 'ltr'
  })
}));
jest.mock('../src/lib/auth-context', () => ({
  useAuth: () => mockAuth,
  useOperationalContext: () => ({
    contextVersion: mockContext
  })
}));
jest.mock('../src/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    patch: (...args: any[]) => mockPatch(...args)
  }
}));
jest.mock('../src/components/admin/error-handler', () => ({
  useApiErrorHandler: () => mockError
}));
jest.mock('../src/components/admin/toast-provider', () => ({
  useToast: () => ({
    showToast: mockToast
  })
}));
jest.mock('../src/components/admin/admin-action-bar', () => ({
  useRegisterAdminActions: (actions: any[]) => {
    mockActions = actions;
  },
  useStableHandlers: (handlers: any) => ({
    exec: (name: string) => handlers[name]()
  }),
  ActionAddIcon: () => null,
  ActionRefreshIcon: () => null
}));
jest.mock('../src/components/admin/ui', () => ({
  Button: ({
    children,
    loading,
    ...props
  }: any) => React.createElement('button', {
    ...props,
    disabled: props.disabled || loading
  }, children),
  Input: (props: any) => React.createElement('input', props),
  Textarea: (props: any) => React.createElement('textarea', props),
  Select: (props: any) => React.createElement('select', props),
  Modal: ({
    open,
    children
  }: any) => open ? React.createElement('section', {
    role: 'dialog'
  }, children) : null,
  ConfirmDialog: ({
    open,
    onConfirm,
    onClose,
    children
  }: any) => open ? React.createElement('section', {
    'data-confirm': true
  }, React.createElement('button', {
    onClick: onConfirm
  }, 'CONFIRM'), React.createElement('button', {
    onClick: onClose
  }, 'KEEP'), children) : null,
  Pagination: () => null
}));
jest.mock('../src/components/f9/F9Lookup', () => ({
  F9Lookup: (props: any) => React.createElement('lookup', props)
}));
jest.mock('../src/components/factory/ProductUomSelect', () => ({
  ProductUomSelect: (props: any) => React.createElement('product-uom', props)
}));
jest.mock('../src/components/admin/admin-data-grid', () => ({
  AdminDataGrid: (props: any) => React.createElement('grid', props, props.data?.length ? props.columns.find((column: any) => column.key === 'actions')?.render(props.data[0]) : null)
}));
jest.mock('../src/components/admin/datagrid/actions-menu', () => ({
  ActionsMenu: (props: any) => React.createElement('row-actions', props)
}));
import { IssueVoucherDialog } from '../src/components/inventory/issue-voucher-dialog';
import { IssueVouchersPanel } from '../src/components/inventory/issue-vouchers-panel';
import { emptyIssueVoucher, changeIssueType, changeIssueWarehouse, changeMaintenanceRequest, changeProductionOrder, changeProductionRun, issuePayload, formFromIssue, ISSUE_TYPES, IssueType } from '../src/components/inventory/issue-voucher-form';
import { newIssueClientId } from '../src/app/admin/inventory/finished-goods-issues/_components/lines-editor';
let tree: any;
function filled(type: IssueType) {
  const form = changeIssueType(emptyIssueVoucher(), type);
  return {
    ...form,
    warehouseId: 'wa',
    maintenanceRequestId: 'ma',
    productionOrderId: 'oa',
    productionRunId: 'ra',
    purpose: 'purpose',
    notes: 'notes',
    lines: [{
      ...form.lines[0],
      productId: 'pa',
      sparePartId: 'sa',
      quantity: '2',
      unit: 'KG',
      productUomId: 'uom-a',
      warehouseLocationId: 'la',
      batchNumber: 'lot-a',
      serialNumber: 'serial-a',
      expiryDate: '2027-01-01'
    }]
  };
}
function Harness({
  initial,
  edit = false,
  saving = false,
  types = ISSUE_TYPES
}: any) {
  const [form, setForm] = useState(initial || emptyIssueVoucher());
  return React.createElement(IssueVoucherDialog, {
    form,
    onChange: setForm,
    types,
    edit,
    saving,
    onSave: jest.fn(),
    onClose: jest.fn()
  });
}
async function mount(element: any) {
  await act(async () => {
    tree = create(element);
  });
}
function lookup(label: string) {
  return tree.root.findAllByType('lookup').find((node: any) => node.props.label === mockT(label));
}
function selectType() {
  return tree.root.findAllByType('select').find((node: any) => node.props.label === mockT('inventory.issueVoucher.type'));
}
function button(key: string) {
  return tree.root.findAllByType('button').find((node: any) => node.props.children === mockT(key));
}
async function tick() {
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockLocale = 'en';
  mockContext = 1;
  mockAuth = {
    isSuperAdmin: true,
    permissions: {
      permissions: []
    }
  };
  mockGet.mockImplementation(async (path: string) => path === '/inventory/issues/stock' ? {
    data: [],
    meta: {
      total: 0
    },
    available: '10',
    unit: 'KG'
  } : {
    data: [],
    meta: {
      page: 1,
      total: 0,
      totalPages: 0
    }
  });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null;
  jest.useRealTimers();
});
describe('unified issue voucher dependencies and native payloads', () => {
  it('clears all incompatible state on type change', () => {
    const next = changeIssueType(filled('SPARE_PART'), 'RAW_MATERIAL');
    expect(next).toMatchObject({
      issueType: 'RAW_MATERIAL',
      warehouseId: '',
      maintenanceRequestId: '',
      machineName: '',
      productionOrderId: '',
      productionRunId: ''
    });
    expect(next.lines[0]).toMatchObject({
      productId: '',
      unit: '',
      productUomId: '',
      warehouseLocationId: '',
      batchNumber: '',
      serialNumber: '',
      expiryDate: '',
      quantity: ''
    });
  });
  it('clears every warehouse stock identity and quantity on warehouse change', () => {
    const next = changeIssueWarehouse(filled('FINISHED_GOODS'), 'wb');
    expect(next.warehouseId).toBe('wb');
    expect(next.lines[0]).toMatchObject({
      productId: '',
      unit: '',
      warehouseLocationId: '',
      batchNumber: '',
      serialNumber: '',
      quantity: ''
    });
  });
  it('clears run and materials when production order changes', () => {
    const next = changeProductionOrder(filled('RAW_MATERIAL'), 'ob');
    expect(next.productionRunId).toBe('');
    expect(next.lines[0].productId).toBe('');
  });
  it('clears material lines when the production run changes', () => {
    const next = changeProductionRun(filled('RAW_MATERIAL'), 'rb');
    expect(next.productionRunId).toBe('rb');
    expect(next.lines[0]).toMatchObject({
      productId: '',
      warehouseLocationId: '',
      batchNumber: '',
      serialNumber: '',
      quantity: ''
    });
  });
  it('clears the part line when the maintenance request changes and keeps the selected machine', () => {
    const next = changeMaintenanceRequest(filled('SPARE_PART'), 'mb', 'Machine B');
    expect(next.maintenanceRequestId).toBe('mb');
    expect(next.machineName).toBe('Machine B');
    expect(next.lines[0]).toMatchObject({
      productId: '',
      quantity: ''
    });
    expect(next.lines[0].sparePartId).toBeFalsy();
  });
  it('clears the machine when the maintenance request is cleared', () => {
    const next = changeMaintenanceRequest(filled('SPARE_PART'), '');
    expect(next.maintenanceRequestId).toBe('');
    expect(next.machineName).toBe('');
    expect(next.lines[0].sparePartId).toBeFalsy();
  });
  it.each(ISSUE_TYPES)('serializes %s into its native authority payload', type => {
    const form = filled(type),
      payload: any = issuePayload(form);
    expect(payload.issueType).toBeUndefined();
    if (type === 'SPARE_PART') {
      expect(payload).toMatchObject({
        sparePartId: 'sa',
        warehouseId: 'wa',
        quantity: 2
      });
      expect(payload.productionOrderId).toBeUndefined();
    } else {
      expect(payload.lines[0]).toMatchObject({
        productId: 'pa',
        quantity: 2,
        warehouseLocationId: 'la',
        productUomId: 'uom-a'
      });
    }
    if (type === 'RAW_MATERIAL') expect(payload).toMatchObject({
      documentType: 'ISSUE',
      productionOrderId: 'oa',
      productionRunId: 'ra'
    });
    if (type === 'FINISHED_GOODS') {
      expect(payload.issueWarehouseId).toBe('wa');
      expect(payload.productionOrderId).toBeUndefined();
    }
    expect(issuePayload(form, true).requestId).toBeUndefined();
  });
  it('restores the existing movement ProductUom snapshot during edit', () => {
    const form = formFromIssue('FINISHED_GOODS', {
      issueWarehouseId: 'wa',
      issueDate: '2026-11-18',
      lines: [{
        productId: 'pa',
        quantity: 2,
        unit: 'BOX'
      }],
      movement: {
        lines: [{
          productId: 'pa',
          quantity: 2,
          unit: 'BOX',
          productUomId: 'box-uom'
        }]
      }
    });
    expect(form.lines[0].productUomId).toBe('box-uom');
  });
});
describe('dynamic issue form interaction', () => {
  it.each(['en', 'ar'])('starts with only the required authorized issue types in %s', async locale => {
    mockLocale = locale;
    await mount(React.createElement(Harness, {
      types: ['RAW_MATERIAL']
    }));
    expect(selectType().props.required).toBe(true);
    expect(selectType().props.value).toBe('');
    expect(selectType().props.options).toEqual([{
      value: 'RAW_MATERIAL',
      label: mockT('inventory.warehouseApprovals.typeRAW_MATERIAL')
    }]);
    expect(tree.root.findAllByType('lookup')).toHaveLength(0);
    await act(async () => selectType().props.onChange({
      target: {
        value: 'RAW_MATERIAL'
      }
    }));
    expect(lookup('inventory.finishedGoodsIssue.issueWarehouse')).toBeDefined();
    expect(lookup('production.materialDocuments.order')).toBeUndefined();
  });
  it.each(ISSUE_TYPES)('shows the appropriate context and warehouse-scoped adapter for %s', async type => {
    await mount(React.createElement(Harness, {
      initial: filled(type)
    }));
    expect(Boolean(lookup('inventory.issueVoucher.maintenanceRequest'))).toBe(type === 'SPARE_PART');
    expect(Boolean(lookup('production.materialDocuments.order'))).toBe(type === 'RAW_MATERIAL');
    const item = tree.root.findAllByType('lookup').find((node: any) => node.props.adapter.endpoint === '/inventory/issues/candidates');
    expect(item.props.filters).toMatchObject({
      type,
      warehouseId: 'wa'
    });
    if (type === 'RAW_MATERIAL') expect(lookup('production.materialDocuments.run').props.filters).toEqual({
      productionOrderId: 'oa'
    });
    if (type !== 'SPARE_PART') expect(lookup('inventory.finishedGoodsIssue.warehouseLocation').props.filters).toMatchObject({
      warehouseId: 'wa',
      type
    });
  });
  it('confirms warehouse clearing and removes the old item immediately on confirmation', async () => {
    await mount(React.createElement(Harness, {
      initial: filled('FINISHED_GOODS')
    }));
    await act(async () => lookup('inventory.finishedGoodsIssue.issueWarehouse').props.onChange('wb'));
    expect(lookup('inventory.finishedGoodsIssue.issueWarehouse').props.value).toBe('wa');
    await act(async () => tree.root.findAllByType('button').find((node: any) => node.props.children === 'CONFIRM').props.onClick());
    expect(lookup('inventory.finishedGoodsIssue.issueWarehouse').props.value).toBe('wb');
    const item = tree.root.findAllByType('lookup').find((node: any) => node.props.adapter.endpoint === '/inventory/issues/candidates');
    expect(item.props.value).toBe('');
    expect(item.props.filters.warehouseId).toBe('wb');
    expect(lookup('inventory.finishedGoodsIssue.warehouseLocation').props.value).toBe('');
  });
  it('confirms maintenance-request change before clearing the selected spare part', async () => {
    await mount(React.createElement(Harness, {
      initial: filled('SPARE_PART')
    }));
    await act(async () => lookup('inventory.issueVoucher.maintenanceRequest').props.onChange('mb'));
    expect(lookup('inventory.issueVoucher.maintenanceRequest').props.value).toBe('ma');
    await act(async () => tree.root.findAllByType('button').find((node: any) => node.props.children === 'CONFIRM').props.onClick());
    expect(lookup('inventory.issueVoucher.maintenanceRequest').props.value).toBe('mb');
    expect(tree.root.findAllByType('lookup').find((node: any) => node.props.adapter.endpoint === '/inventory/issues/candidates').props.value).toBe('');
  });
  it('confirms production-run change before clearing the selected material', async () => {
    await mount(React.createElement(Harness, {
      initial: filled('RAW_MATERIAL')
    }));
    await act(async () => lookup('production.materialDocuments.run').props.onChange('rb'));
    expect(lookup('production.materialDocuments.run').props.value).toBe('ra');
    await act(async () => tree.root.findAllByType('button').find((node: any) => node.props.children === 'CONFIRM').props.onClick());
    expect(lookup('production.materialDocuments.run').props.value).toBe('rb');
    expect(tree.root.findAllByType('lookup').find((node: any) => node.props.adapter.endpoint === '/inventory/issues/candidates').props.value).toBe('');
  });
  it('removes spare-part context and item fields after confirmed type change', async () => {
    await mount(React.createElement(Harness, {
      initial: filled('SPARE_PART')
    }));
    await act(async () => selectType().props.onChange({
      target: {
        value: 'RAW_MATERIAL'
      }
    }));
    await act(async () => tree.root.findAllByType('button').find((node: any) => node.props.children === 'CONFIRM').props.onClick());
    expect(lookup('inventory.issueVoucher.maintenanceRequest')).toBeUndefined();
    expect(lookup('inventory.finishedGoodsIssue.issueWarehouse').props.value).toBe('');
    expect(tree.root.findAllByType('lookup').some((node: any) => node.props.adapter.endpoint === '/inventory/issues/candidates')).toBe(false);
  });
  it('locks type and warehouse for edit and disables save during submission', async () => {
    await mount(React.createElement(Harness, {
      initial: filled('RAW_MATERIAL'),
      edit: true,
      saving: true
    }));
    expect(selectType().props.disabled).toBe(true);
    expect(lookup('inventory.finishedGoodsIssue.issueWarehouse').props.disabled).toBe(true);
    expect(lookup('production.materialDocuments.order').props.disabled).toBe(true);
    expect(button('actions.save').props.disabled).toBe(true);
  });
});
describe('unified page native API routing', () => {
  it.each(ISSUE_TYPES)('POSTs %s through its existing canonical endpoint', async type => {
    await mount(React.createElement(IssueVouchersPanel));
    await tick();
    await act(async () => mockActions.find(action => action.id === 'new').onClick());
    const dialog = tree.root.findByType(IssueVoucherDialog);
    await act(async () => dialog.props.onChange(filled(type)));
    await act(async () => tree.root.findByType(IssueVoucherDialog).props.onSave());
    const path = type === 'SPARE_PART' ? '/maintenance/requests/ma/parts' : type === 'RAW_MATERIAL' ? '/production/material-documents' : '/inventory/finished-goods-issues';
    expect(mockPost).toHaveBeenCalledWith(path, expect.any(Object));
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
  it('offers only create modes granted by the native permission', async () => {
    mockAuth = {
      isSuperAdmin: false,
      permissions: {
        permissions: ['production-material-document:create']
      }
    };
    await mount(React.createElement(IssueVouchersPanel));
    await act(async () => mockActions.find(action => action.id === 'new').onClick());
    expect(tree.root.findByType(IssueVoucherDialog).props.types).toEqual(['RAW_MATERIAL']);
    expect(mockGet).not.toHaveBeenCalledWith('/inventory/issues', expect.anything());
  });
  it('preserves the draft after a recoverable save error', async () => {
    mockPost.mockRejectedValueOnce(new Error('rejected'));
    await mount(React.createElement(IssueVouchersPanel));
    await tick();
    await act(async () => mockActions.find(action => action.id === 'new').onClick());
    await act(async () => tree.root.findByType(IssueVoucherDialog).props.onChange(filled('FINISHED_GOODS')));
    await act(async () => tree.root.findByType(IssueVoucherDialog).props.onSave());
    expect(tree.root.findByType(IssueVoucherDialog).props.form.lines[0].productId).toBe('pa');
    expect(mockError).toHaveBeenCalled();
  });
});


describe('same-record editing and read-only lifecycle states', () => {
  const row = { key: 'FINISHED_GOODS:existing', type: 'FINISHED_GOODS', entityId: 'existing', parentEntityId: 'existing', reference: 'FGI-EXISTING', status: 'DRAFT', createdAt: '2026-11-18', warehouse: { id: 'wa', name: 'Warehouse A' } };
  function response(status = 'DRAFT') {
    mockGet.mockImplementation(async (path: string) => {
      if (path === '/inventory/issues') return { data: [{ ...row, status }], meta: { page: 1, total: 1, totalPages: 1 } };
      if (path === '/inventory/finished-goods-issues/existing') return { data: { id: 'existing', status, issueWarehouseId: 'wa', issueDate: '2026-11-18', lines: [{ id: 'line-existing', productId: 'pa', quantity: 1, unit: 'KG' }] } };
      return { data: [], meta: { page: 1, total: 0, totalPages: 0 }, available: '10', unit: 'KG' };
    });
  }
  it('PATCHes the selected native identity and never creates another issue on edit', async () => {
    response();
    await mount(React.createElement(IssueVouchersPanel)); await tick();
    await act(async () => button('common.actions').props.onClick());
    const menu = tree.root.findByType('row-actions');
    await act(async () => menu.props.actions.find((action: any) => action.label === mockT('inventory.finishedGoodsIssue.edit')).onClick(row));
    const dialog = tree.root.findByType(IssueVoucherDialog);
    expect(dialog.props.edit).toBe(true);
    expect(dialog.props.form.lines[0].quantity).toBe('1');
    await act(async () => dialog.props.onChange({ ...dialog.props.form, lines: [{ ...dialog.props.form.lines[0], quantity: '2' }] }));
    await act(async () => tree.root.findByType(IssueVoucherDialog).props.onSave());
    expect(mockPatch).toHaveBeenCalledWith('/inventory/finished-goods-issues/existing', expect.objectContaining({ lines: [expect.objectContaining({ quantity: 2 })] }));
    expect(mockPost).not.toHaveBeenCalled();
  });
  it('keeps posted records read-only and exposes only authorized remaining actions', async () => {
    response('POSTED');
    mockAuth = { isSuperAdmin: false, permissions: { permissions: ['finished-goods-issue:read'] } };
    await mount(React.createElement(IssueVouchersPanel)); await tick();
    expect(mockActions.some((action) => action.id === 'new')).toBe(false);
    await act(async () => button('common.actions').props.onClick());
    expect(tree.root.findByType('row-actions').props.actions.map((action: any) => action.label)).toEqual([mockT('inventory.finishedGoodsIssue.view')]);
  });
});

describe('client identifiers on non-secure contexts', () => {
  it('generates a stable fallback when crypto.randomUUID is unavailable', () => {
    const original = globalThis.crypto;
    try {
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {} });
      expect(newIssueClientId()).toMatch(/^\d+-\d+(?:\.\d+)?$/);
      expect(newIssueClientId()).not.toBe(newIssueClientId());
    } finally {
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: original });
    }
  });
});
