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
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => React.createElement('a', props, children)
}));
import { IssueVoucherDialog } from '../src/components/inventory/issue-voucher-dialog';
import { IssueVouchersPanel, reasonRequired } from '../src/components/inventory/issue-vouchers-panel';
import { approvalRequiresReason, nativeActionPath, requiredPermission } from '../src/components/inventory/warehouse-approvals-panel';
import { emptyIssueVoucher, changeIssueType, changeIssueWarehouse, changeMaintenanceRequest, changeProductionOrder, changeProductionRun, issueEndpoint, issuePayload, issuePermissionPrefix, formFromIssue, ISSUE_TYPES, IssueType } from '../src/components/inventory/issue-voucher-form';
import { createEmptyIssueLine, issueLineIdentity, mergeDuplicateIssueLines, newIssueClientId } from '../src/app/admin/inventory/finished-goods-issues/_components/lines-editor';
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
function standaloneSpare(extraLines: any[] = []) {
  const form = changeIssueType(emptyIssueVoucher(), 'SPARE_PART');
  const first = {
    ...form.lines[0],
    productId: 'pa',
    sparePartId: 'sa',
    quantity: '2',
    unit: 'KG',
    productUomId: 'uom-a',
    warehouseLocationId: 'la',
    batchNumber: 'lot-a',
    serialNumber: 'serial-a',
    expiryDate: '2027-01-01',
    notes: 'line note'
  };
  return {
    ...form,
    warehouseId: 'wa',
    maintenanceRequestId: '',
    purpose: 'purpose',
    notes: 'notes',
    lines: [first, ...extraLines]
  };
}
function secondSpareLine() {
  return {
    ...createEmptyIssueLine(),
    productId: 'pb',
    sparePartId: 'sb',
    quantity: '3',
    unit: 'KG',
    warehouseLocationId: 'lb',
    batchNumber: 'lot-b',
    serialNumber: 'serial-b',
    expiryDate: '2027-02-02',
    notes: 'second line'
  };
}
function Harness({
  initial,
  edit = false,
  saving = false,
  types = ISSUE_TYPES,
  onSave = jest.fn(),
  onClose = jest.fn()
}: any) {
  const [form, setForm] = useState(initial || emptyIssueVoucher());
  return React.createElement(IssueVoucherDialog, {
    form,
    onChange: setForm,
    types,
    edit,
    saving,
    onSave,
    onClose
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
function buttonsByText(text: string) {
  return tree.root.findAllByType('button').filter((node: any) => node.props.children === text);
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
  it('routes standalone spare parts to the native multi-line endpoint and keeps linked spares single-line', () => {
    const standalone = standaloneSpare([secondSpareLine()]);
    const payload: any = issuePayload(standalone);
    expect(issueEndpoint('SPARE_PART', '')).toBe('/inventory/spare-part-issues');
    expect(issueEndpoint('SPARE_PART', undefined)).toBe('/inventory/spare-part-issues');
    expect(issueEndpoint('SPARE_PART', 'ma')).toBe('/maintenance/requests/ma/parts');
    expect(payload).toMatchObject({
      issueWarehouseId: 'wa',
      issueDate: standalone.date,
      purpose: 'purpose',
      notes: 'notes',
      requestId: standalone.requestId
    });
    expect(payload.lines).toHaveLength(2);
    expect(payload.lines[0]).toMatchObject({
      sparePartId: 'sa',
      productId: 'pa',
      quantity: 2,
      unit: 'KG',
      productUomId: 'uom-a',
      warehouseLocationId: 'la',
      batchNumber: 'lot-a',
      serialNumber: 'serial-a',
      expiryDate: '2027-01-01',
      notes: 'line note'
    });
    expect(payload.lines[1]).toMatchObject({ sparePartId: 'sb', productId: 'pb', quantity: 3 });
    const editPayload: any = issuePayload(standalone, true);
    expect(editPayload.requestId).toBeUndefined();
    expect(editPayload.lines).toHaveLength(2);
    const linked: any = issuePayload(filled('SPARE_PART'));
    expect(linked.lines).toBeUndefined();
    expect(linked).toMatchObject({ sparePartId: 'sa', warehouseId: 'wa', quantity: 2 });
  });
  it('never builds a nested maintenance URL with an empty request id', () => {
    for (const requestId of ['', undefined]) expect(issueEndpoint('SPARE_PART', requestId)).not.toContain('/maintenance/requests//parts');
    expect(issueEndpoint('SPARE_PART', '')).toBe('/inventory/spare-part-issues');
  });
  it('serializes finished goods as a multi-line native document', () => {
    const form = { ...filled('FINISHED_GOODS'), lines: [filled('FINISHED_GOODS').lines[0], secondSpareLine()] };
    const payload: any = issuePayload(form);
    expect(payload.lines).toHaveLength(2);
    expect(payload.lines.map((line: any) => line.quantity)).toEqual([2, 3]);
    expect(payload).toMatchObject({ issueWarehouseId: 'wa', requestId: form.requestId, issueDate: form.date });
    expect(issuePayload(form, true).lines).toHaveLength(2);
  });
  it('reconstructs standalone spare lines and linked spare legacy records', () => {
    const standalone = formFromIssue('SPARE_PART', {
      issueWarehouseId: 'wa',
      issueDate: '2026-11-18',
      lines: [
        { sparePartId: 'sa', productId: 'pa', quantity: 2, unit: 'KG', warehouseLocationId: 'la', batchNumber: 'b1' },
        { sparePartId: 'sb', productId: 'pb', quantity: 3, unit: 'KG', warehouseLocationId: 'lb', serialNumber: 's2' }
      ]
    });
    expect(standalone.maintenanceRequestId).toBe('');
    expect(standalone.lines).toHaveLength(2);
    expect(standalone.lines[1]).toMatchObject({ sparePartId: 'sb', quantity: '3', serialNumber: 's2' });
    const linked = formFromIssue('SPARE_PART', { warehouseId: 'wa', sparePartId: 'sa', sparePart: { productId: 'pa' }, quantity: 4, unit: 'KG', reason: 'r' }, 'ma');
    expect(linked.maintenanceRequestId).toBe('ma');
    expect(linked.lines).toHaveLength(1);
    expect(linked.lines[0]).toMatchObject({ sparePartId: 'sa', productId: 'pa', quantity: '4' });
  });
  it('resolves the effective permission prefix per authority', () => {
    expect(issuePermissionPrefix('SPARE_PART', 'SPARE_PART_ISSUE')).toBe('spare-part-issue');
    expect(issuePermissionPrefix('SPARE_PART', 'MAINTENANCE_REQUEST_PART')).toBe('maintenance-request-parts');
    expect(issuePermissionPrefix('FINISHED_GOODS', 'FLAT')).toBe('finished-goods-issue');
  });
  it('requires a reason only for native transitions whose DTO requires one', () => {
    const standalone = { type: 'SPARE_PART' as IssueType, authority: 'SPARE_PART_ISSUE' as const };
    const linked = { type: 'SPARE_PART' as IssueType, authority: 'MAINTENANCE_REQUEST_PART' as const };
    expect(reasonRequired('cancel-approval', standalone)).toBe(true);
    expect(reasonRequired('cancel', standalone)).toBe(true);
    expect(reasonRequired('reject', standalone)).toBe(true);
    expect(reasonRequired('withdraw', standalone)).toBe(false);
    expect(reasonRequired('cancel-approval', linked)).toBe(false);
    expect(approvalRequiresReason(standalone as any, 'reject')).toBe(true);
    expect(approvalRequiresReason(standalone as any, 'cancelApproval')).toBe(true);
    expect(approvalRequiresReason(linked as any, 'reject')).toBe(false);
  });
  it('routes shared approval actions to each native endpoint and permission', () => {
    const standalone: any = { type: 'SPARE_PART', authority: 'SPARE_PART_ISSUE', entityId: 'issue-1', parentEntityId: null };
    const linked: any = { type: 'SPARE_PART', authority: 'MAINTENANCE_REQUEST_PART', entityId: 'line-1', parentEntityId: 'req-1' };
    const raw: any = { type: 'RAW_MATERIAL', authority: 'FLAT', entityId: 'doc-1', parentEntityId: null };
    const finished: any = { type: 'FINISHED_GOODS', authority: 'FLAT', entityId: 'fgi-1', parentEntityId: null };
    expect(nativeActionPath(standalone, 'approve')).toBe('/inventory/spare-part-issues/issue-1/approve');
    expect(nativeActionPath(standalone, 'cancelApproval')).toBe('/inventory/spare-part-issues/issue-1/cancel-approval');
    expect(nativeActionPath(linked, 'approve')).toBe('/maintenance/requests/req-1/parts/line-1/approve');
    expect(nativeActionPath(raw, 'reject')).toBe('/production/material-documents/doc-1/reject');
    expect(nativeActionPath(finished, 'cancelApproval')).toBe('/inventory/finished-goods-issues/fgi-1/cancel-approval');
    expect(requiredPermission(standalone, 'approve')).toBe('spare-part-issue:approve');
    expect(requiredPermission(standalone, 'cancelApproval')).toBe('spare-part-issue:cancel-approval');
    expect(requiredPermission(linked, 'approve')).toBe('maintenance-request-parts:approve');
    expect(requiredPermission(raw, 'reject')).toBe('production-material-document:reject');
    expect(requiredPermission(finished, 'cancelApproval')).toBe('finished-goods-issue:cancel-approval');
  });
  it('merges duplicate stock identities deterministically', () => {
    const first = { ...standaloneSpare().lines[0], quantity: '2', warehouseLocationId: 'la', batchNumber: 'b1', serialNumber: '' };
    const duplicate = { ...createEmptyIssueLine(), sparePartId: 'sa', productId: 'pa', quantity: '3', unit: 'KG', productUomId: 'uom-a', warehouseLocationId: 'la', batchNumber: 'b1', serialNumber: '', expiryDate: '2027-01-01' };
    const other = { ...secondSpareLine(), sparePartId: 'sx', productId: 'px', warehouseLocationId: 'la', batchNumber: 'b1', serialNumber: '' };
    const merged = mergeDuplicateIssueLines([first, duplicate, other]);
    expect(merged.mergedCount).toBe(1);
    expect(merged.lines).toHaveLength(2);
    expect(merged.lines[0].quantity).toBe('5');
    expect(merged.lines[1].quantity).toBe('3');
  });
  it('rounds merged quantities to the four-decimal API contract', () => {
    const first = { ...createEmptyIssueLine(), sparePartId: 'sa', productId: 'pa', quantity: '0.1', unit: 'KG', productUomId: 'uom-a', warehouseLocationId: 'la', batchNumber: 'b1', expiryDate: '2027-01-01' };
    const duplicate = { ...first, quantity: '0.2' };
    const merged = mergeDuplicateIssueLines([first, duplicate]);
    expect(merged.mergedCount).toBe(1);
    expect(merged.lines).toHaveLength(1);
    expect(merged.lines[0].quantity).toBe('0.3');
  });
  it('does not merge lines that differ by UOM or expiry', () => {
    const first = { ...createEmptyIssueLine(), sparePartId: 'sa', productId: 'pa', quantity: '1', unit: 'KG', productUomId: 'uom-a', warehouseLocationId: 'la', batchNumber: 'b1', expiryDate: '2027-01-01' };
    const otherUom = { ...first, unit: 'BOX', productUomId: 'uom-b', quantity: '2' };
    const otherExpiry = { ...first, expiryDate: '2027-02-01', quantity: '3' };
    expect(issueLineIdentity(first)).not.toBe(issueLineIdentity(otherUom));
    expect(issueLineIdentity(first)).not.toBe(issueLineIdentity(otherExpiry));
    const merged = mergeDuplicateIssueLines([first, otherUom, otherExpiry]);
    expect(merged.mergedCount).toBe(0);
    expect(merged.lines.map(line => line.quantity)).toEqual(['1', '2', '3']);
  });
  it('uses the exact type labels in both languages', () => {
    expect(mockT('inventory.issueVoucher.itemSparePart')).toBe('Spare Part');
    expect(mockT('inventory.issueVoucher.itemFinishedProduct')).toBe('Finished Product');
    expect(mockT('inventory.issueVoucher.itemRawMaterial')).toBe('Raw Material');
    expect(mockT('inventory.warehouseApprovals.typeSPARE_PART')).toBe('Spare Part');
    expect(mockT('inventory.warehouseApprovals.typeFINISHED_GOODS')).toBe('Finished Product');
    mockLocale = 'ar';
    expect(mockT('inventory.issueVoucher.itemSparePart')).toBe('قطعة الغيار');
    expect(mockT('inventory.issueVoucher.itemFinishedProduct')).toBe('المنتج التام');
    expect(mockT('inventory.issueVoucher.itemRawMaterial')).toBe('المادة الخام');
    expect(mockT('inventory.issueVoucher.maintenanceRequestOptional')).toBe('طلب الصيانة (اختياري)');
    expect(mockT('inventory.warehouseApprovals.typeSPARE_PART')).toBe('قطعة الغيار');
    expect(mockT('inventory.warehouseApprovals.typeFINISHED_GOODS')).toBe('المنتج التام');
    mockLocale = 'en';
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
    expect(Boolean(lookup('inventory.issueVoucher.maintenanceRequestOptional'))).toBe(type === 'SPARE_PART');
    expect(Boolean(lookup('production.materialDocuments.order'))).toBe(type === 'RAW_MATERIAL');
    const item = tree.root.findAllByType('lookup').find((node: any) => node.props.adapter.endpoint === '/inventory/issues/candidates');
    expect(item.props.filters).toMatchObject({
      type,
      warehouseId: 'wa'
    });
    if (type === 'RAW_MATERIAL') expect(lookup('production.materialDocuments.run').props.filters).toEqual({
      productionOrderId: 'oa'
    });
    expect(lookup('inventory.finishedGoodsIssue.warehouseLocation').props.filters).toMatchObject({
      warehouseId: 'wa',
      type
    });
    expect(lookup('inventory.issueVoucher.stockIdentity').props.filters).toMatchObject({
      warehouseId: 'wa',
      type,
      productId: 'pa'
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
    await act(async () => lookup('inventory.issueVoucher.maintenanceRequestOptional').props.onChange('mb'));
    expect(lookup('inventory.issueVoucher.maintenanceRequestOptional').props.value).toBe('ma');
    await act(async () => tree.root.findAllByType('button').find((node: any) => node.props.children === 'CONFIRM').props.onClick());
    expect(lookup('inventory.issueVoucher.maintenanceRequestOptional').props.value).toBe('mb');
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
    expect(lookup('inventory.issueVoucher.maintenanceRequestOptional')).toBeUndefined();
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
  it('saves a standalone spare voucher without any maintenance request', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    await mount(React.createElement(Harness, {
      initial: standaloneSpare(),
      onSave
    }));
    expect(lookup('inventory.issueVoucher.maintenanceRequestOptional').props.value).toBe('');
    expect(lookup('inventory.issueVoucher.maintenanceRequestOptional').props.required).toBeUndefined();
    await act(async () => button('actions.save').props.onClick());
    await act(async () => {
      await Promise.resolve();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(tree.root.findAll((node: any) => node.props && node.props.role === 'alert')).toHaveLength(0);
  });
  it('adds and removes lines for spare parts as well as finished goods', async () => {
    await mount(React.createElement(Harness, {
      initial: standaloneSpare()
    }));
    const addLabel = mockT('inventory.finishedGoodsIssue.addLine');
    expect(addLabel).toBe('+ Add Item');
    expect(buttonsByText(addLabel)).toHaveLength(1);
    await act(async () => buttonsByText(addLabel)[0].props.onClick());
    expect(tree.root.findByType(IssueVoucherDialog).props.form.lines).toHaveLength(2);
    const removeLabel = mockT('inventory.finishedGoodsIssue.removeLine');
    expect(buttonsByText(removeLabel)).toHaveLength(2);
    await act(async () => buttonsByText(removeLabel)[0].props.onClick());
    expect(tree.root.findByType(IssueVoucherDialog).props.form.lines).toHaveLength(1);
  });
  it('uses the exact Arabic add-item label in RTL', async () => {
    mockLocale = 'ar';
    await mount(React.createElement(Harness, {
      initial: standaloneSpare()
    }));
    const addLabel = mockT('inventory.finishedGoodsIssue.addLine');
    expect(addLabel).toBe('+ إضافة بند');
    expect(buttonsByText(addLabel)).toHaveLength(1);
    expect(tree.root.findByType(IssueVoucherDialog).props.form.lines).toHaveLength(1);
    await act(async () => buttonsByText(addLabel)[0].props.onClick());
    expect(tree.root.findByType(IssueVoucherDialog).props.form.lines).toHaveLength(2);
    mockLocale = 'en';
  });
  it('merges duplicate lines in the editor and shows the translated notice', async () => {
    const first = { ...standaloneSpare().lines[0], quantity: '2', warehouseLocationId: 'la', batchNumber: 'b1', serialNumber: '' };
    const duplicate = { ...createEmptyIssueLine(), sparePartId: 'sa', productId: 'pa', quantity: '3', unit: 'KG', productUomId: 'uom-a', warehouseLocationId: 'la', batchNumber: 'b1', serialNumber: '', expiryDate: '2027-01-01' };
    await mount(React.createElement(Harness, {
      initial: { ...standaloneSpare(), lines: [first, duplicate] }
    }));
    const quantityInputs = tree.root.findAllByType('input').filter((node: any) => node.props.label === mockT('inventory.finishedGoodsIssue.quantity') && node.props.type === 'number');
    expect(quantityInputs).toHaveLength(2);
    await act(async () => quantityInputs[0].props.onChange({
      target: {
        value: '2'
      }
    }));
    const lines = tree.root.findByType(IssueVoucherDialog).props.form.lines;
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe('5');
    expect(tree.root.findAllByType('p').some((node: any) => node.props.children === mockT('inventory.issueVoucher.duplicateMerged'))).toBe(true);
  });
  it('opens candidate, location and stock lookups without prior search text', async () => {
    await mount(React.createElement(Harness, {
      initial: standaloneSpare()
    }));
    const item = tree.root.findAllByType('lookup').find((node: any) => node.props.adapter.endpoint === '/inventory/issues/candidates');
    expect(item.props.adapter.detailFilters).toBe(true);
    expect(item.props.adapter.searchFields).toEqual(expect.arrayContaining(['code', 'name']));
    expect(item.props.filters).toEqual({ type: 'SPARE_PART', warehouseId: 'wa' });
    expect(item.props.filters.search).toBeUndefined();
    const stock = lookup('inventory.issueVoucher.stockIdentity');
    expect(stock.props.adapter.endpoint).toBe('/inventory/issues/stock');
    expect(stock.props.adapter.detailFilters).toBe(true);
    expect(stock.props.filters).toMatchObject({ type: 'SPARE_PART', warehouseId: 'wa', productId: 'pa', locationId: 'la' });
    expect(lookup('inventory.finishedGoodsIssue.warehouseLocation').props.adapter.endpoint).toBe('/inventory/issues/locations');
  });
  it('keeps the voucher context when the maintenance request changes', async () => {
    await mount(React.createElement(Harness, {
      initial: filled('SPARE_PART')
    }));
    await act(async () => lookup('inventory.issueVoucher.maintenanceRequestOptional').props.onChange('mb'));
    await act(async () => tree.root.findAllByType('button').find((node: any) => node.props.children === 'CONFIRM').props.onClick());
    const form = tree.root.findByType(IssueVoucherDialog).props.form;
    expect(form).toMatchObject({ warehouseId: 'wa', issueType: 'SPARE_PART', purpose: 'purpose', notes: 'notes', maintenanceRequestId: 'mb' });
    expect(form.lines[0].sparePartId).toBeFalsy();
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
  it('POSTs standalone spare parts to the native spare-part issue endpoint', async () => {
    await mount(React.createElement(IssueVouchersPanel));
    await tick();
    await act(async () => mockActions.find(action => action.id === 'new').onClick());
    await act(async () => tree.root.findByType(IssueVoucherDialog).props.onChange(standaloneSpare([secondSpareLine()])));
    await act(async () => tree.root.findByType(IssueVoucherDialog).props.onSave());
    expect(mockPost).toHaveBeenCalledWith('/inventory/spare-part-issues', expect.objectContaining({
      issueWarehouseId: 'wa',
      lines: expect.arrayContaining([expect.objectContaining({ sparePartId: 'sa' }), expect.objectContaining({ sparePartId: 'sb' })])
    }));
    expect(mockPost).not.toHaveBeenCalledWith(expect.stringContaining('/maintenance/requests//'), expect.anything());
  });
  it('reads and edits a standalone spare row through its native endpoint with SparePartIssue audit', async () => {
    const row = {
      key: 'SPARE_PART:issue-1', type: 'SPARE_PART', authority: 'SPARE_PART_ISSUE', entityId: 'issue-1', parentEntityId: null,
      reference: 'SPI-1', title: 'purpose', status: 'DRAFT', createdAt: '2026-11-18', documentDate: '2026-11-18',
      warehouse: { id: 'wa', name: 'Warehouse A', code: 'WA' }
    };
    mockAuth = { isSuperAdmin: false, permissions: { permissions: ['spare-part-issue:read', 'spare-part-issue:update', 'audit:read'] } };
    mockGet.mockImplementation(async (path: string) => {
      if (path === '/inventory/issues') return { data: [row], meta: { page: 1, total: 1, totalPages: 1 } };
      if (path === '/inventory/spare-part-issues/issue-1') return { data: { id: 'issue-1', status: 'DRAFT', issueWarehouseId: 'wa', issueDate: '2026-11-18', lines: [{ sparePartId: 'sa', productId: 'pa', quantity: 2, unit: 'KG' }, { sparePartId: 'sb', productId: 'pb', quantity: 3, unit: 'KG' }] } };
      if (path === '/audit-logs') return { data: [] };
      return { data: [], meta: { page: 1, total: 0, totalPages: 0 } };
    });
    await mount(React.createElement(IssueVouchersPanel));
    await tick();
    await act(async () => button('common.actions').props.onClick());
    const menu = tree.root.findByType('row-actions');
    await act(async () => menu.props.actions.find((action: any) => action.label === mockT('inventory.finishedGoodsIssue.view')).onClick(row));
    expect(mockGet).toHaveBeenCalledWith('/inventory/spare-part-issues/issue-1');
    expect(mockGet).toHaveBeenCalledWith('/audit-logs', expect.objectContaining({ params: expect.objectContaining({ entity: 'SparePartIssue' }) }));
    expect(tree.root.findAllByType('tr')).toHaveLength(3);
    expect(tree.root.findAllByType('a').some((node: any) => node.props.href === '/admin/maintenance/spare-part-issues')).toBe(false);
    await act(async () => tree.root.findByType('row-actions').props.actions.find((action: any) => action.label === mockT('inventory.finishedGoodsIssue.edit')).onClick(row));
    const dialog = tree.root.findByType(IssueVoucherDialog);
    expect(dialog.props.form.lines).toHaveLength(2);
    await act(async () => tree.root.findByType(IssueVoucherDialog).props.onSave());
    expect(mockPatch).toHaveBeenCalledWith('/inventory/spare-part-issues/issue-1', expect.objectContaining({ lines: expect.any(Array) }));
  });
  it('uses native transition suffixes for standalone spare rows and keeps the maintenance request suffix for linked spares', async () => {
    const standaloneRow = {
      key: 'SPARE_PART:issue-2', type: 'SPARE_PART', authority: 'SPARE_PART_ISSUE', entityId: 'issue-2', parentEntityId: null,
      reference: 'SPI-2', title: null, status: 'DRAFT', createdAt: '2026-11-18', documentDate: '2026-11-18', warehouse: null
    };
    const linkedRow = {
      key: 'SPARE_PART:line-1', type: 'SPARE_PART', authority: 'MAINTENANCE_REQUEST_PART', entityId: 'line-1', parentEntityId: 'req-1',
      reference: 'MR-1', title: null, status: 'DRAFT', createdAt: '2026-11-18', documentDate: '2026-11-18', warehouse: null
    };
    mockAuth = { isSuperAdmin: false, permissions: { permissions: ['spare-part-issue:read', 'spare-part-issue:submit', 'maintenance-request-parts:read', 'maintenance-request-parts:request'] } };
    mockGet.mockImplementation(async (path: string) => path === '/inventory/issues'
      ? { data: [standaloneRow, linkedRow], meta: { page: 1, total: 2, totalPages: 1 } }
      : { data: [], meta: { page: 1, total: 0, totalPages: 0 } });
    await mount(React.createElement(IssueVouchersPanel));
    await tick();
    await act(async () => button('common.actions').props.onClick());
    await act(async () => tree.root.findByType('row-actions').props.actions.find((action: any) => action.label === mockT('inventory.finishedGoodsIssue.submit')).onClick(standaloneRow));
    await act(async () => tree.root.findAllByType('button').find((node: any) => node.props.children === 'CONFIRM').props.onClick());
    expect(mockPatch).toHaveBeenCalledWith('/inventory/spare-part-issues/issue-2/submit', expect.any(Object));
    await act(async () => tree.root.findByType('row-actions').props.actions.find((action: any) => action.label === mockT('inventory.finishedGoodsIssue.submit')).onClick(linkedRow));
    await act(async () => tree.root.findAllByType('button').find((node: any) => node.props.children === 'CONFIRM').props.onClick());
    expect(mockPatch).toHaveBeenCalledWith('/maintenance/requests/req-1/parts/line-1/request', undefined);
  });
  it('requires and sends a trimmed reason for standalone cancel-approval', async () => {
    const row = {
      key: 'SPARE_PART:issue-3', type: 'SPARE_PART', authority: 'SPARE_PART_ISSUE', entityId: 'issue-3', parentEntityId: null,
      reference: 'SPI-3', title: null, status: 'APPROVED', createdAt: '2026-11-18', documentDate: '2026-11-18', warehouse: null
    };
    mockAuth = { isSuperAdmin: false, permissions: { permissions: ['spare-part-issue:read', 'spare-part-issue:cancel-approval'] } };
    mockGet.mockImplementation(async (path: string) => path === '/inventory/issues'
      ? { data: [row], meta: { page: 1, total: 1, totalPages: 1 } }
      : { data: [], meta: { page: 1, total: 0, totalPages: 0 } });
    await mount(React.createElement(IssueVouchersPanel));
    await tick();
    await act(async () => button('common.actions').props.onClick());
    await act(async () => tree.root.findByType('row-actions').props.actions.find((action: any) => action.label === mockT('inventory.finishedGoodsIssue.cancelApproval')).onClick(row));
    const textarea = tree.root.findByType('textarea');
    expect(textarea.props.required).toBe(true);
    await act(async () => tree.root.findAllByType('button').find((node: any) => node.props.children === 'CONFIRM').props.onClick());
    expect(mockPatch).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error');
    await act(async () => textarea.props.onChange({ target: { value: '  approval superseded  ' } }));
    await act(async () => tree.root.findAllByType('button').find((node: any) => node.props.children === 'CONFIRM').props.onClick());
    expect(mockPatch).toHaveBeenCalledWith('/inventory/spare-part-issues/issue-3/cancel-approval', { reason: 'approval superseded' });
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
