import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { maintenanceWorkOrderDocumentModel } from '../src/components/print/maintenance-work-order-document-print';
import { PrintDocument } from '../src/components/print/PrintDocument';
import type { MaintenanceWorkOrder } from '../src/lib/admin-types';
const { act, create } = require('react-test-renderer');
let mockLocale: 'en' | 'ar' = 'en', mockActions: any[] = [];
const mockT = (key: string): string => { const value = key.split('.').reduce<any>((node, part) => node?.[part], mockLocale === 'ar' ? ar : en); if (typeof value !== 'string') throw new Error(`Missing ${key}`); return value; };
const mockOpen = jest.fn(async (..._args: any[]) => {}), mockDialog = jest.fn();
jest.mock('../src/lib/i18n/use-translation', () => ({ useTranslation: () => ({ t: mockT, locale: mockLocale }) }));
jest.mock('../src/lib/auth-context', () => ({ useAuth: () => ({ activeContext: { companyId: 'company-a', branchId: 'branch-a', companyName: 'Company A', companyNameEn: 'Company A', companyNameAr: 'Company A', branchName: 'Branch A', branchNameEn: 'Branch A', branchNameAr: 'Branch A' }, archivedContext: null, isArchivedContext: false, contextVersion: 1, contextLoading: false, user: { id: 'reviewer', name: 'Reviewer' } }) }));
jest.mock('../src/components/admin/error-modal', () => ({ useErrorModal: () => ({ showError: mockDialog }) }));
jest.mock('../src/components/admin/error-handler', () => ({ useApiErrorHandler: () => mockDialog }));
jest.mock('../src/components/print/print-runtime', () => ({ openPrintDocument: (...args: any[]) => mockOpen(...args) }));
jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'wo-1' }), useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../src/components/admin/admin-action-bar', () => ({ useRegisterAdminActions: (actions: any[]) => { mockActions = actions; }, useStableHandlers: (handlers: any) => ({ exec: (name: string) => handlers[name]() }), ActionBackIcon: () => null, ActionRefreshIcon: () => null, ActionEditIcon: () => null, ActionAddIcon: () => null, ActionDeleteIcon: () => null, ActionPrintIcon: () => null }));
jest.mock('../src/components/admin/ui', () => ({ Button: ({ children, loading: _loading, ...props }: any) => React.createElement('button', props, children), Card: ({ children }: any) => React.createElement('div', null, children), CardHeader: ({ children }: any) => React.createElement('div', null, children), CardContent: ({ children }: any) => React.createElement('div', null, children), DataTable: () => null, LoadingState: () => React.createElement('span', null, 'loading'), EmptyState: () => null, ErrorState: ({ message }: any) => React.createElement('span', null, message), Modal: ({ children }: any) => React.createElement('div', null, children), Input: () => null, ConfirmDialog: () => null, Select: () => null, Textarea: () => null, StatusBadge: ({ status }: any) => React.createElement('span', null, status) }));
jest.mock('../src/components/admin/toast-provider', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/components/f9', () => ({ F9Lookup: () => null, machineAdapter: {}, machineComponentAdapter: {}, maintenanceRequestAdapter: {}, warehouseAdapter: {}, userAdapter: {}, sparePartAdapter: {}, productAdapter: {} }));
jest.mock('../src/components/maintenance/CmmsStatusBadge', () => ({ CmmsStatusBadge: () => null }));
jest.mock('../src/components/maintenance/CmmsPriorityBadge', () => ({ CmmsPriorityBadge: () => null }));
jest.mock('../src/lib/form-validation', () => ({ adaptFieldErrorsToMap: () => ({}), focusFirstInvalidField: () => {} }));
jest.mock('../src/lib/api', () => ({ api: { get: jest.fn(), patch: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
const Page = require('../src/app/admin/maintenance/work-orders/[id]/page').default;
const api = require('../src/lib/api').api;

const fixture = (): MaintenanceWorkOrder => ({
  id: 'private-work-order', companyId: 'private-company', branchId: 'private-branch',
  workOrderNumber: 'WO-001', title: 'Replace conveyor bearing', description: 'Bearing noise on the main conveyor',
  type: 'CORRECTIVE', priority: 'HIGH', status: 'IN_PROGRESS', scopeType: 'MACHINE',
  productionLineId: 'private-line', workLocation: 'Line one', costCenterId: 'private-cost-center',
  machineId: 'private-machine', machineComponentId: 'private-component', requestId: 'private-request',
  warehouseId: 'private-warehouse', assignedToId: 'private-tech', supervisorId: 'private-supervisor',
  createdById: 'private-creator', plannedStartAt: '2026-11-12T08:00:00Z', plannedEndAt: '2026-11-12T12:00:00Z',
  startedAt: '2026-11-12T09:00:00Z', completedAt: null, cancelledAt: null, cancelReason: null,
  estimatedCost: 150, actualCost: 90, notes: 'Recorded work-order note',
  createdAt: '2026-11-12T07:00:00Z', updatedAt: '2026-11-12T10:00:00Z',
  company: { id: 'private-company', name: 'Company A' },
  branch: { id: 'private-branch', name: 'Branch A' },
  machine: { id: 'private-machine', code: 'MC-01', name: 'Conveyor' },
  productionLine: { id: 'private-line', code: 'L1', name: 'Line One' },
  machineComponent: { id: 'private-component', code: 'BRG', name: 'Bearing' },
  request: { id: 'private-request', requestNumber: 'MR-001', title: 'Bearing noise', status: 'IN_PROGRESS' },
  warehouse: { id: 'private-warehouse', code: 'WH-1', name: 'Spare Parts Store' },
  assignedTo: { id: 'private-tech', name: 'Technician' },
  supervisor: { id: 'private-supervisor', name: 'Supervisor' },
  createdBy: { id: 'private-creator', name: 'Planner' },
  parts: [
    { id: 'private-part', workOrderId: 'private-work-order', sparePartId: 'private-spare', productId: null, quantity: 2, unit: 'PCS', unitCost: 25, totalCost: 50, notes: null, issuedQuantity: 1, stockIssueStatus: 'PARTIALLY_ISSUED', lastIssueAt: '2026-11-12T09:30:00Z', lastIssueById: 'private-tech', createdAt: '2026-11-12T08:00:00Z', updatedAt: '2026-11-12T09:30:00Z', sparePart: { id: 'private-spare', code: 'BRG-1', name: 'Conveyor bearing' } },
  ],
  costEntries: [
    { id: 'private-cost', workOrderId: 'private-work-order', type: 'LABOR', description: 'Technician labor', amount: 40, incurredAt: '2026-11-12T10:00:00Z', createdById: 'private-creator', createdAt: '2026-11-12T10:00:00Z', updatedAt: '2026-11-12T10:00:00Z', createdBy: { id: 'private-creator', name: 'Planner' } },
  ],
});

describe('maintenance work order business document', () => {
  it.each(['ar', 'en'] as const)('renders %s work order identity, context, lines and notes without technical IDs', locale => {
    mockLocale = locale;
    const model = maintenanceWorkOrderDocumentModel(fixture(), mockT, locale);
    const html = renderToStaticMarkup(React.createElement(PrintDocument, { model: { ...model, locale, company: 'Company A', printedAt: new Date(), timeZone: 'Asia/Aden' }, t: mockT }));
    expect(model.mode).toBe('DOCUMENT');
    expect(model.documentNumber).toBe('WO-001');
    expect(model.title).toBe(mockT('maintenance.maintenanceWorkOrder'));
    expect(model.subtitle).toBe('Replace conveyor bearing');
    expect(model.description).toBe('Bearing noise on the main conveyor');
    expect(model.sections.map(section => section.title)).toEqual([mockT('maintenance.workOrderParts'), mockT('maintenance.workOrderCostEntries')]);
    expect(model.sections[0].columns.map(column => column.key)).toEqual(['item', 'quantity', 'unit', 'unitCost', 'totalCost', 'issueStatus', 'issuedQuantity']);
    expect(model.sections[1].columns.map(column => column.key)).toEqual(['type', 'description', 'amount', 'incurredAt', 'createdBy']);
    expect(html).toContain('WO-001'); expect(html).toContain('Conveyor'); expect(html).toContain('Conveyor bearing');
    expect(html).toContain('PCS'); expect(html).toContain('Technician labor'); expect(html).toContain('Recorded work-order note');
    expect(html).toContain(mockT('reports.printDocument.workOrderDocumentNote'));
    expect(html).not.toMatch(/private-work-order|private-company|private-branch|private-machine|private-user|private-part|private-cost|private-request|private-spare|private-line|private-warehouse|private-tech|private-supervisor|private-creator|<button|<input|<nav|NaN|Invalid Date/);
  });

  it('prints per-line quantities and counts without inventing a cross-unit total', () => {
    const model = maintenanceWorkOrderDocumentModel(fixture(), mockT, 'en');
    expect(model.summary?.find(field => field.label === mockT('maintenance.workOrderParts'))?.value).toBe('1');
    expect(model.summary?.find(field => field.label === mockT('maintenance.workOrderCostEntries'))?.value).toBe('1');
    expect(model.sections[0].totals).toBeUndefined();
  });

  it.each(['ar', 'en'] as const)('renders the %s document with no line sections when the work order has no lines', locale => {
    mockLocale = locale;
    const data = fixture(); data.parts = []; data.costEntries = []; data.description = null;
    const model = maintenanceWorkOrderDocumentModel(data, mockT, locale);
    expect(model.sections).toHaveLength(0);
    expect(model.summary?.find(field => field.label === mockT('maintenance.workOrderParts'))?.value).toBe('0');
    expect(model.description).toBeUndefined();
  });

  it('rejects a work order without a business number or title', () => {
    const data = fixture(); data.workOrderNumber = '';
    expect(() => maintenanceWorkOrderDocumentModel(data, mockT, 'en')).toThrow('unavailable');
    const noTitle = fixture(); noTitle.title = '';
    expect(() => maintenanceWorkOrderDocumentModel(noTitle, mockT, 'en')).toThrow('unavailable');
  });
});

describe('actual maintenance work order page through shared engine', () => {
  let tree: any; const action = () => mockActions.find(item => item.id === 'print');
  beforeEach(async () => {
    jest.clearAllMocks(); mockLocale = 'en';
    api.get.mockImplementation((url: string) => url.startsWith('/maintenance-cost/')
      ? Promise.reject(new Error('cost summary unavailable'))
      : Promise.resolve(fixture()));
    await act(async () => { tree = create(React.createElement(Page)); });
  });
  afterEach(() => act(() => tree.unmount()));

  it('prints the canonical work order document through the shared engine', async () => {
    expect(action().enabled).toBe(true);
    await act(async () => { await action().onClick(); });
    expect(api.get).toHaveBeenCalledWith('/maintenance-work-orders/wo-1');
    expect(mockOpen).toHaveBeenCalledTimes(1);
    const model = mockOpen.mock.calls[0][0];
    expect(model.mode).toBe('DOCUMENT'); expect(model.documentNumber).toBe('WO-001');
    expect(model.company).toBe('Company A'); expect(model.branch).toBe('Branch A');
    expect(model.printedBy).toBe('Reviewer');
    expect(model.description).toBe('Bearing noise on the main conveyor');
    expect(model.sections[0].rows[0].sparePart.name).toBe('Conveyor bearing');
    expect(model.sections[1].rows[0].description).toBe('Technician labor');
  });

  it('opens no document when the print-time work order read is denied', async () => {
    api.get.mockRejectedValueOnce(new Error('Denied'));
    await act(async () => { await action().onClick(); });
    expect(mockOpen).not.toHaveBeenCalled(); expect(mockDialog).toHaveBeenCalled();
  });
});
