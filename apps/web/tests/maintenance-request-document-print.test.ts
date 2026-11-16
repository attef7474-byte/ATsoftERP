import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { maintenanceRequestDocumentModel, type MaintenanceRequestDocumentData } from '../src/components/print/maintenance-request-document-print';
import { PrintDocument } from '../src/components/print/PrintDocument';
const { act, create } = require('react-test-renderer');
let mockLocale: 'en' | 'ar' = 'en', mockActions: any[] = [];
const mockT = (key: string): string => { const value = key.split('.').reduce<any>((node, part) => node?.[part], mockLocale === 'ar' ? ar : en); if (typeof value !== 'string') throw new Error(`Missing ${key}`); return value; };
const mockOpen = jest.fn(async (..._args: any[]) => {}), mockDialog = jest.fn();
jest.mock('../src/lib/i18n/use-translation', () => ({ useTranslation: () => ({ t: mockT, locale: mockLocale }) }));
jest.mock('../src/lib/auth-context', () => ({ useAuth: () => ({ activeContext: { companyId: 'company-a', branchId: 'branch-a', companyName: 'Company A', companyNameEn: 'Company A', companyNameAr: 'Company A', branchName: 'Branch A', branchNameEn: 'Branch A', branchNameAr: 'Branch A' }, archivedContext: null, isArchivedContext: false, contextVersion: 1, contextLoading: false, user: { id: 'reviewer', name: 'Reviewer' } }) }));
jest.mock('../src/components/admin/error-modal', () => ({ useErrorModal: () => ({ showError: mockDialog }) }));
jest.mock('../src/components/admin/error-handler', () => ({ useApiErrorHandler: () => mockDialog }));
jest.mock('../src/components/print/print-runtime', () => ({ openPrintDocument: (...args: any[]) => mockOpen(...args) }));
jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'req-1' }), useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../src/components/admin/admin-action-bar', () => ({ useRegisterAdminActions: (actions: any[]) => { mockActions = actions; }, useStableHandlers: (handlers: any) => ({ exec: (name: string) => handlers[name]() }), ActionBackIcon: () => null, ActionRefreshIcon: () => null, ActionPrintIcon: () => null }));
jest.mock('../src/components/admin/ui', () => ({ Button: ({ children, loading: _loading, ...props }: any) => React.createElement('button', props, children), LoadingState: () => React.createElement('span', null, 'loading'), ErrorState: ({ message }: any) => React.createElement('span', null, message), StatusBadge: ({ status }: any) => React.createElement('span', null, status) }));
jest.mock('../src/lib/api', () => ({ api: { get: jest.fn() } }));
const Page = require('../src/app/admin/maintenance/requests/[id]/print/page').default;
const api = require('../src/lib/api').api;

const fixture = (): MaintenanceRequestDocumentData => ({
  id: 'private-request', requestNumber: 'MR-001', machineId: 'private-machine', requestedById: 'private-user',
  type: 'CORRECTIVE', priority: 'HIGH', status: 'IN_PROGRESS', title: 'Replace bearing',
  description: 'Bearing noise reported', reportedAt: '2026-11-12T08:00:00Z', startDate: '2026-11-12', endDate: null,
  startedAt: '2026-11-12T09:00:00Z', completedAt: null, createdAt: '2026-11-12T07:00:00Z', updatedAt: '2026-11-12T09:00:00Z',
  estimatedCost: 100, actualCost: 50, downtimeHours: 2.5, isEmergency: true,
  machine: { id: 'private-machine', name: 'Mixer', code: 'MC-01' },
  productionLine: { id: 'private-line', name: 'Line One', code: 'L1' },
  machineComponent: { id: 'private-component', name: 'Bearing', code: 'BRG' },
  operationType: { id: 'private-op', name: 'Mechanical', code: 'MECH' },
  costCenter: { id: 'private-cc', name: 'Maintenance', code: 'CC-1' },
  requestedBy: { id: 'private-user', name: 'Requester', email: 'requester@example.test' },
  assignedTo: { id: 'private-tech', name: 'Technician', email: 'tech@example.test' },
  tasks: [{ id: 'private-task', title: 'Inspect bearing', status: 'COMPLETED', assignedTo: { id: 'private-tech', name: 'Technician' }, startedAt: '2026-11-12T09:00:00Z', completedAt: '2026-11-12T10:00:00Z' } as any],
  partsUsed: [{ id: 'private-part', productId: 'private-product', quantity: 2, unitCost: 10, totalCost: 20, product: { id: 'private-product', name: 'Bearing', code: 'BRG-1', unit: 'PCS' } } as any],
  costEntries: [{ id: 'private-cost', type: 'LABOR', description: 'Labor', amount: 30, incurredAt: '2026-11-12T10:00:00Z' } as any],
  downtimeLogs: [{ id: 'private-downtime', machineId: 'private-machine', reason: 'Bearing failure', startTime: '2026-11-12T08:00:00Z', endTime: '2026-11-12T10:00:00Z', durationHours: 2 } as any],
  notes: 'Recorded note',
});

describe('maintenance request business document', () => {
  it.each(['ar', 'en'] as const)('renders %s request metadata, lines and description without technical IDs', locale => {
    mockLocale = locale;
    const model = maintenanceRequestDocumentModel(fixture(), mockT, locale);
    const html = renderToStaticMarkup(React.createElement(PrintDocument, { model: { ...model, locale, company: 'Company A', printedAt: new Date(), timeZone: 'Asia/Aden' }, t: mockT }));
    expect(model.mode).toBe('DOCUMENT');
    expect(model.documentNumber).toBe('MR-001');
    expect(model.title).toBe(mockT('maintenance.maintenanceRequest'));
    expect(model.subtitle).toBe('Replace bearing');
    expect(model.description).toBe('Bearing noise reported');
    expect(model.sections.map(section => section.title)).toEqual([
      mockT('details.maintenanceRequest.tasks'), mockT('maintenanceWorkflow.workflowParts'),
      mockT('maintenanceWorkflow.workflowCosts'), mockT('details.maintenanceRequest.downtimeLogs'),
    ]);
    expect(model.sections[1].columns.map(column => column.key)).toEqual(['product', 'unit', 'quantity', 'unitCost', 'totalCost']);
    expect(html).toContain('MR-001'); expect(html).toContain('Mixer'); expect(html).toContain('Bearing');
    expect(html).toContain('PCS'); expect(html).toContain('Bearing failure'); expect(html).toContain('Bearing noise reported');
    expect(html).toContain(mockT('reports.printDocument.maintenanceRequestNote'));
    expect(html).not.toMatch(/private-request|private-machine|private-user|private-task|private-part|private-cost|private-downtime|<button|<input|<nav|NaN|Invalid Date/);
  });

  it.each(['ar', 'en'] as const)('renders the %s document with no line sections when the request has no lines', locale => {
    mockLocale = locale;
    const data = fixture(); data.tasks = []; data.partsUsed = []; data.costEntries = []; data.downtimeLogs = []; data.description = null;
    const model = maintenanceRequestDocumentModel(data, mockT, locale);
    expect(model.sections).toHaveLength(0);
    expect(model.summary?.find(field => field.label === mockT('details.maintenanceRequest.tasks'))?.value).toBe('0');
    expect(model.description).toBeUndefined();
  });

  it('rejects a request without a business number or title', () => {
    const data = fixture(); data.requestNumber = '';
    expect(() => maintenanceRequestDocumentModel(data, mockT, 'en')).toThrow('unavailable');
  });
});

describe('actual maintenance request page through shared engine', () => {
  let tree: any; const action = () => mockActions.find(item => item.id === 'print');
  beforeEach(async () => { jest.clearAllMocks(); mockLocale = 'en'; api.get.mockResolvedValue(fixture()); await act(async () => { tree = create(React.createElement(Page)) }); });
  afterEach(() => act(() => tree.unmount()));

  it('prints the canonical request document through the shared engine', async () => {
    expect(action().enabled).toBe(true);
    await act(async () => { await action().onClick() });
    expect(api.get).toHaveBeenCalledWith('/maintenance/requests/req-1/print');
    expect(mockOpen).toHaveBeenCalledTimes(1);
    const model = mockOpen.mock.calls[0][0];
    expect(model.mode).toBe('DOCUMENT'); expect(model.documentNumber).toBe('MR-001');
    expect(model.company).toBe('Company A'); expect(model.description).toBe('Bearing noise reported');
    expect(model.sections[1].rows[0].product.unit).toBe('PCS');
  });

  it('re-reads the canonical print endpoint at print time and prints the fresh payload', async () => {
    // The initial page load already read the endpoint once. Printing must read
    // it again instead of reusing the React state captured on screen.
    api.get.mockResolvedValue({ ...fixture(), description: 'Description recorded just before printing.' });
    await act(async () => { await action().onClick() });
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get.mock.calls.every((call: any[]) => call[0] === '/maintenance/requests/req-1/print')).toBe(true);
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockOpen.mock.calls[0][0].mode).toBe('DOCUMENT');
    expect(mockOpen.mock.calls[0][0].documentNumber).toBe('MR-001');
    expect(mockOpen.mock.calls[0][0].description).toBe('Description recorded just before printing.');
  });

  it('opens no document when the print-time request read is denied', async () => {
    api.get.mockRejectedValueOnce(new Error('Denied'));
    await act(async () => { await action().onClick() });
    expect(mockOpen).not.toHaveBeenCalled(); expect(mockDialog).toHaveBeenCalled();
  });
});
