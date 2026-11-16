import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { maintenanceRepairOrderDocumentModel } from '../src/components/print/maintenance-repair-order-document-print';
import { PrintDocument } from '../src/components/print/PrintDocument';
import type { RepairOrderAction, RepairOrderDetail } from '../src/app/admin/maintenance/repair-orders/repair-order-api';
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
jest.mock('../src/lib/auth-context', () => ({ useAuth: () => ({ activeContext: { companyId: 'company-a', branchId: 'branch-a', companyName: 'Company A', companyNameEn: 'Company A', companyNameAr: 'Company A', branchName: 'Branch A', branchNameEn: 'Branch A', branchNameAr: 'Branch A' }, archivedContext: null, isArchivedContext: false, contextVersion: 1, contextLoading: false, user: { id: 'reviewer', name: 'Reviewer' }, permissions: { permissions: ['repair-orders:read'] }, isSuperAdmin: false }) }));
jest.mock('../src/components/admin/error-modal', () => ({ useErrorModal: () => ({ showError: mockDialog }) }));
jest.mock('../src/components/admin/error-handler', () => ({ useApiErrorHandler: () => mockDialog }));
jest.mock('../src/components/print/print-runtime', () => ({ openPrintDocument: (...args: any[]) => mockOpen(...args) }));
jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'ro-1' }), useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
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
  EmptyState: () => null, ErrorState: ({ message }: any) => React.createElement('span', null, message),
  Modal: ({ children }: any) => React.createElement('div', null, children),
  ConfirmDialog: () => null, Select: () => null, Input: () => null, Textarea: () => null,
  StatusBadge: ({ status }: any) => React.createElement('span', null, status),
  LocalizedValue: ({ value }: any) => React.createElement('span', null, value),
}));
jest.mock('../src/components/admin/toast-provider', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));

const Page = require('../src/app/admin/maintenance/repair-orders/[id]/page').default;
const api = require('../src/lib/api').api;

const TECHNICAL_IDS = [
  'private-repair-order', 'private-spare', 'private-warehouse', 'private-machine',
  'private-component', 'private-request', 'private-replacement', 'private-installed',
  'private-in-movement', 'private-out-movement', 'private-scrap-movement',
  'private-opener', 'private-inspector', 'private-repairer', 'private-tester',
];

function action(overrides: Partial<RepairOrderAction> = {}): RepairOrderAction {
  return {
    id: 'private-action',
    actionType: 'REPAIR',
    actionStatus: 'DONE',
    description: 'Replaced the outer race and re-greased the bearing.',
    result: 'Bearing rotates freely.',
    performedByUserId: 'private-repairer',
    performedAt: '2026-11-11T11:00:00Z',
    durationMinutes: 45,
    notes: null,
    ...overrides,
  };
}

function fixture(): RepairOrderDetail {
  return {
    id: 'private-repair-order',
    repairOrderNumber: 'RO-0007',
    status: 'UNDER_REPAIR',
    sparePartId: 'private-spare',
    sourceCondition: 'DAMAGED_REPAIRABLE',
    sourceQuantity: 5,
    reservedQuantity: 5,
    repairedQuantity: 1,
    scrappedQuantity: 0,
    remainingQuantity: 4,
    targetCondition: 'USED_SERVICEABLE',
    estimatedRepairCost: 120,
    actualRepairCost: 80,
    openedAt: '2026-11-10T08:00:00Z',
    inspectionStartedAt: '2026-11-10T09:00:00Z',
    repairStartedAt: '2026-11-11T10:00:00Z',
    testStartedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: '2026-11-10T07:30:00Z',
    updatedAt: '2026-11-11T12:00:00Z',
    sparePart: { id: 'private-spare', code: 'BRG-77', name: 'Gearbox bearing' },
    warehouse: { id: 'private-warehouse', code: 'WH-SP', name: 'Spare Parts Store' },
    machine: { id: 'private-machine', code: 'MC-9', name: 'Main Conveyor' },
    machineComponent: { id: 'private-component', code: 'CMP-2', name: 'Drive end' },
    maintenanceRequest: { id: 'private-request', requestNumber: 'MR-0042', title: 'Bearing noise' },
    failureDescription: 'Outer race pitting found during inspection.',
    repairDescription: 'Replaced outer race and re-greased the bearing.',
    inspectionResult: 'Repairable after race replacement.',
    testResult: 'Passed the run-in test.',
    testNotes: 'Temperature stable during the run.',
    externalRepair: false,
    externalRepairProviderName: null,
    notes: 'Recorded repair-order note.',
    cancelReason: null,
    sourceType: 'REPLACEMENT_HISTORY',
    sourceId: 'private-replacement',
    maintenanceRequestId: 'private-request',
    replacementHistoryId: 'private-replacement',
    installedPartId: 'private-installed',
    conditionInMovementId: 'private-in-movement',
    conditionOutMovementId: 'private-out-movement',
    inventoryScrapMovementId: 'private-scrap-movement',
    machineId: 'private-machine',
    machineComponentId: 'private-component',
    openedByUserId: 'private-opener',
    inspectedByUserId: 'private-inspector',
    repairedByUserId: 'private-repairer',
    testedByUserId: 'private-tester',
    closedByUserId: null,
    productId: null,
    actions: [
      action(),
      action({ id: 'private-action-2', actionType: 'INSPECTION', actionStatus: 'DONE', description: 'Measured the shaft play.', result: 'Within tolerance.', performedByUserId: 'private-inspector', performedAt: '2026-11-10T09:30:00Z', durationMinutes: 20 }),
    ],
  };
}

function renderDocument(data: RepairOrderDetail, locale: 'en' | 'ar') {
  mockLocale = locale;
  const model = maintenanceRepairOrderDocumentModel(data, mockT, locale);
  const html = renderToStaticMarkup(React.createElement(PrintDocument, {
    model: {
      ...model,
      locale,
      company: 'Company A',
      branch: 'Branch A',
      printedBy: 'Reviewer',
      printedAt: new Date('2026-11-12T13:45:00Z'),
      timeZone: 'Asia/Aden',
    },
    t: mockT,
  }));
  return { model, html };
}

const forbidden = /private-|lockVersion|sparePartId|machineId|warehouseId|maintenanceRequestId|replacementHistoryId|installedPartId|openedByUserId|inspectedByUserId|repairedByUserId|testedByUserId|closedByUserId|performedByUserId|<button|<input|<select|<nav|NaN|Invalid Date|reports\.printDocument\./;

describe('repair order business document', () => {
  it.each(['ar', 'en'] as const)('RO-P01/P02/P03/P04/P05/P06 renders the %s document with business identity, context, source part and repair record', locale => {
    const { model, html } = renderDocument(fixture(), locale);

    expect(model.mode).toBe('DOCUMENT');
    expect(model.documentNumber).toBe('RO-0007');
    expect(model.title).toBe(mockT('maintenance.repairOrder'));
    expect(model.subtitle).toBe('[BRG-77] Gearbox bearing');
    expect(model.scopeLabel).toBe(mockT('reports.printDocument.repairOrderDocumentScope'));
    expect(html).toContain('Company A');
    expect(html).toContain('Branch A');

    const labels = (model.metadata || []).map(field => field.label);
    expect(labels).toContain(mockT('common.status'));
    expect(labels).toContain(mockT('maintenance.condition'));
    expect(labels).toContain(mockT('maintenance.targetCondition'));
    expect(labels).toContain(mockT('maintenance.warehouse'));
    expect(labels).toContain(mockT('maintenance.machine'));
    expect(labels).toContain(mockT('maintenance.repairComponent'));
    expect(labels).toContain(mockT('maintenance.repairRequest'));

    expect(model.sections.map(section => section.title)).toEqual([
      mockT('maintenance.repairRecord'),
      mockT('maintenance.repairActions'),
    ]);
    expect(model.sections[0].columns.map(column => column.key)).toEqual(['field', 'value']);
    expect(model.sections[1].columns.map(column => column.key)).toEqual(['actionType', 'actionStatus', 'description', 'result', 'performedAt', 'duration']);

    for (const expected of [
      'RO-0007', '[BRG-77] Gearbox bearing', '[WH-SP] Spare Parts Store', '[MC-9] Main Conveyor',
      '[CMP-2] Drive end', '[MR-0042] Bearing noise', 'Outer race pitting found during inspection.',
      'Replaced outer race and re-greased the bearing.', 'Repairable after race replacement.',
      'Passed the run-in test.', 'Temperature stable during the run.',
      'Replaced the outer race and re-greased the bearing.', 'Bearing rotates freely.',
      'Recorded repair-order note.', mockT('reports.printDocument.repairOrderDocumentNote'),
    ]) {
      expect(html).toContain(expected);
    }
    expect(html).not.toMatch(forbidden);
  });

  it('RO-P03 refuses to print a repair order without its generated business number or source part', () => {
    const noNumber = fixture(); noNumber.repairOrderNumber = null;
    expect(() => maintenanceRepairOrderDocumentModel(noNumber, mockT, 'en')).toThrow('unavailable');
    const blankNumber = fixture(); blankNumber.repairOrderNumber = '';
    expect(() => maintenanceRepairOrderDocumentModel(blankNumber, mockT, 'en')).toThrow('unavailable');
    const noPart = fixture(); noPart.sparePart = null;
    expect(() => maintenanceRepairOrderDocumentModel(noPart, mockT, 'en')).toThrow('unavailable');
  });

  it('RO-P05/P08 does not print raw source, movement, warehouse, machine or performer identifiers', () => {
    const { html } = renderDocument(fixture(), 'en');
    for (const id of TECHNICAL_IDS) expect(html).not.toContain(id);
    expect(html).not.toContain('REPLACEMENT_HISTORY');
    expect(html).not.toContain('Repairer');
  });

  it('RO-P07 prints estimated and actual cost only when recorded', () => {
    const withCosts = renderDocument(fixture(), 'en');
    const costLabels = (withCosts.model.summary || []).map(field => field.label);
    expect(costLabels).toEqual([
      mockT('maintenance.repairEstimatedCost'),
      mockT('maintenance.repairActualCost'),
      mockT('maintenance.repairActions'),
    ]);
    expect(withCosts.html).toContain('120');
    expect(withCosts.html).toContain('80');

    const withoutCosts = fixture();
    withoutCosts.estimatedRepairCost = null;
    withoutCosts.actualRepairCost = null;
    const rendered = renderDocument(withoutCosts, 'en');
    expect((rendered.model.summary || []).map(field => field.label)).toEqual([mockT('maintenance.repairActions')]);
  });

  it('RO-P07/P11 omits unrecorded optional fields and empty narrative/action sections', () => {
    const minimal = fixture();
    minimal.targetCondition = null;
    minimal.inspectionResult = null;
    minimal.failureDescription = null;
    minimal.repairDescription = null;
    minimal.testResult = null;
    minimal.testNotes = null;
    minimal.cancelReason = null;
    minimal.notes = null;
    minimal.actions = [];
    minimal.estimatedRepairCost = null;
    minimal.actualRepairCost = null;
    minimal.externalRepair = false;
    minimal.externalRepairProviderName = null;
    minimal.inspectionStartedAt = null;
    minimal.repairStartedAt = null;
    minimal.openedAt = null;
    minimal.createdAt = null;
    minimal.updatedAt = null;
    minimal.maintenanceRequest = null;
    minimal.machine = null;
    minimal.machineComponent = null;

    const { model, html } = renderDocument(minimal, 'en');
    expect(model.sections).toHaveLength(0);
    expect((model.summary || []).map(field => field.label)).toEqual([mockT('maintenance.repairActions')]);
    const metadataValue = (label: string) => (model.metadata || []).find(field => field.label === label)?.value;
    expect(metadataValue(mockT('maintenance.targetCondition'))).toBeUndefined();
    expect(metadataValue(mockT('maintenance.repairExternalProvider'))).toBeUndefined();
    expect(metadataValue(mockT('maintenance.repairCompletedAt'))).toBeUndefined();
    expect(metadataValue(mockT('maintenance.repairCancelledAt'))).toBeUndefined();
    expect(html).not.toContain('—');
    expect(html).not.toContain(mockT('maintenance.repairRecord'));
  });

  it('RO-P12 renders the same model values into the printable HTML for Arabic and English', () => {
    for (const locale of ['ar', 'en'] as const) {
      const { model, html } = renderDocument(fixture(), locale);
      const text = html.replace(/<[^>]+>/g, ' ');
      const expected = [
        ...(model.metadata || []).map(field => field.value),
        ...(model.summary || []).map(field => field.value),
        ...model.sections.flatMap(section => section.rows.flatMap(row => section.columns.map(column => column.value(row)))),
      ];
      for (const value of expected) {
        if (value == null || value === '') continue;
        expect(text).toContain(String(value));
      }
    }
  });
});

describe('actual repair order page through the shared engine', () => {
  let tree: any;
  let detailOverride: RepairOrderDetail | null = null;
  let denied = false;
  const detailUrl = '/maintenance/repair-orders/ro-1';

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
      if (url === `${detailUrl}/workflow`) {
        return Promise.resolve({ repairOrderId: 'ro-1', status: 'UNDER_REPAIR', isTerminal: false, actions: [] });
      }
      if (url === `${detailUrl}/actions`) return Promise.resolve(fixture().actions);
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    await act(async () => { tree = create(React.createElement(Page)); });
  });
  afterEach(() => act(() => tree.unmount()));

  it('RO-P09 re-reads the canonical detail at print time and prints the shared document', async () => {
    expect(printAction().enabled).toBe(true);
    expect(printAction().permission).toBe('repair-orders:read');
    detailOverride = { ...fixture(), repairDescription: 'Repair description recorded just before printing.' };
    await act(async () => { await printAction().onClick(); });

    const detailCalls = api.get.mock.calls.filter((call: any[]) => call[0] === detailUrl);
    expect(detailCalls).toHaveLength(2);
    expect(mockOpen).toHaveBeenCalledTimes(1);
    const model = mockOpen.mock.calls[0][0];
    expect(model.mode).toBe('DOCUMENT');
    expect(model.documentNumber).toBe('RO-0007');
    expect(model.company).toBe('Company A');
    expect(model.branch).toBe('Branch A');
    expect(model.printedBy).toBe('Reviewer');
    expect(model.sections[0].rows.map((row: any) => row.value)).toContain('Repair description recorded just before printing.');
  });

  it('RO-P10 opens no document when the print-time read is denied', async () => {
    denied = true;
    await act(async () => { await printAction().onClick(); });
    expect(mockOpen).not.toHaveBeenCalled();
    expect(mockDialog).toHaveBeenCalled();
  });
});
