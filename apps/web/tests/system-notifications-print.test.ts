import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { systemNotificationsPrintModel, type NotificationsPrintData } from '../src/components/print/system-notifications-print';
import { PrintDocument } from '../src/components/print/PrintDocument';
const { act, create } = require('react-test-renderer');
let mockLocale: 'en' | 'ar' = 'en', mockActions: any[] = [];
const mockT = (key: string): string => { const value = key.split('.').reduce<any>((node, part) => node?.[part], mockLocale === 'ar' ? ar : en); if (typeof value !== 'string') throw new Error(`Missing ${key}`); return value; };
const mockOpen = jest.fn(async (..._args: any[]) => {}), mockDialog = jest.fn();
jest.mock('../src/lib/i18n/use-translation', () => ({ useTranslation: () => ({ t: mockT, locale: mockLocale }) }));
jest.mock('../src/lib/auth-context', () => ({ useAuth: () => ({ activeContext: { companyId: 'company-a', branchId: 'branch-a', companyName: 'Company A', branchName: 'Branch A' }, contextVersion: 1, contextLoading: false, user: { id: 'reviewer', name: 'Reviewer' } }) }));
jest.mock('../src/components/admin/error-modal', () => ({ useErrorModal: () => ({ showError: mockDialog }) }));
jest.mock('../src/components/print/print-runtime', () => ({ openPrintDocument: (...args: any[]) => mockOpen(...args) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../src/components/admin/toast-provider', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/components/admin/admin-action-bar', () => ({ useRegisterAdminActions: (actions: any[]) => { mockActions = actions; }, useStableHandlers: (handlers: any) => ({ exec: (name: string) => handlers[name]() }), ActionBackIcon: () => null, ActionRefreshIcon: () => null, ActionPrintIcon: () => null }));
jest.mock('../src/components/admin/ui', () => ({ Select: (props: any) => React.createElement('select', props), LocalizedValue: () => null, Input: (props: any) => React.createElement('input', props), Button: ({ children, ...props }: any) => React.createElement('button', props, children), DataTable: () => null, Pagination: () => null }));
jest.mock('../src/components/reports', () => ({ ReportPageShell: ({ children, filters }: any) => React.createElement('section', null, filters, children), ReportSummaryCards: () => null, ReportExportButton: (props: any) => React.createElement('button', { onClick: props.onPrint, 'data-pdf': true, disabled: props.printDisabled }) }));
jest.mock('../src/lib/api', () => ({ api: { get: jest.fn() } }));
const Page = require('../src/app/admin/reports/notifications/page').default;
const api = require('../src/lib/api').api;

const fixture = (): NotificationsPrintData => ({
  rows: [{ id: 'private-notification', title: 'Maintenance request assigned', type: 'INFO', read: false, createdAt: '2026-11-12T10:00:00Z' }],
  total: 1, page: 1, pageSize: 20, totalPages: 1,
  cards: [{ label: 'totalNotifications', value: 1 }, { label: 'unreadNotifications', value: 1 }, { label: 'notificationCategories', value: 1 }],
  byType: [{ type: 'INFO', count: 1 }],
});

describe('notifications business print', () => {
  it.each(['ar', 'en'] as const)('renders %s title, localized type and read state without message bodies or IDs', locale => {
    mockLocale = locale; const model = systemNotificationsPrintModel({ data: fixture(), params: {}, labels: {}, scopeKey: 'scope' }, mockT, locale);
    const html = renderToStaticMarkup(React.createElement(PrintDocument, { model: { ...model, locale, company: 'Company A', printedAt: new Date(), timeZone: 'Asia/Aden' }, t: mockT }));
    expect(model.sections[0].columns.map(column => column.key)).toEqual(['title', 'type', 'read', 'createdAt']);
    expect(html).toContain('Maintenance request assigned'); expect(html).toContain(mockT('notifications.INFO')); expect(html).toContain(mockT('notifications.unread'));
    expect(html).toContain(mockT('reports.printDocument.notificationsSecurityNote'));
    expect(html).not.toMatch(/private-notification|<button|<input|<nav|NaN|Invalid Date/);
  });
  it.each(['ar', 'en'] as const)('renders the %s empty state when no notifications exist', locale => {
    mockLocale = locale; const empty: NotificationsPrintData = { rows: [], total: 0, page: 1, pageSize: 20, totalPages: 0, cards: [{ label: 'totalNotifications', value: 0 }, { label: 'unreadNotifications', value: 0 }, { label: 'notificationCategories', value: 0 }], byType: [] };
    const model = systemNotificationsPrintModel({ data: empty, params: {}, labels: {}, scopeKey: 'scope' }, mockT, locale);
    const html = renderToStaticMarkup(React.createElement(PrintDocument, { model: { ...model, locale, company: 'Company A', printedAt: new Date(), timeZone: 'Asia/Aden' }, t: mockT }));
    expect(html).toContain(mockT('reports.printDocument.empty')); expect(html).not.toMatch(/NaN|Invalid Date|<button|<input/);
  });
  it('rejects a dataset above the print row limit', () => {
    const data = fixture(); data.rows = Array.from({ length: 501 }, (_, i) => ({ ...data.rows[0], id: 'row-' + i }));
    expect(() => systemNotificationsPrintModel({ data, params: {}, labels: {}, scopeKey: 'scope' }, mockT, 'en')).toThrow('limitExceeded');
  });
});

describe('actual notifications page through shared engine', () => {
  let tree: any; const action = () => mockActions.find(item => item.id === 'print');
  beforeEach(async () => { jest.clearAllMocks(); mockLocale = 'en'; api.get.mockImplementation(async (_route: string, options: any) => ({ ...fixture(), page: options.params.page, pageSize: options.params.pageSize, totalPages: Math.ceil(1 / options.params.pageSize) })); await act(async () => { tree = create(React.createElement(Page)) }); });
  afterEach(() => act(() => tree.unmount()));
  it('prints the bounded canonical notifications through the shared PDF action', async () => {
    const pdf = tree.root.findAllByType('button').find((button: any) => button.props['data-pdf']); await act(async () => { await pdf.props.onClick() });
    expect(api.get.mock.calls.at(-1)[0]).toBe('/reports/notifications'); expect(api.get.mock.calls.at(-1)[1].params).toMatchObject({ page: 1, pageSize: 100 });
    expect(mockOpen.mock.calls[0][0].title).toBe(mockT('reports.notificationsReport')); expect(mockOpen.mock.calls[0][0].company).toBe('Company A');
  });
  it('opens no document if a later collection page is denied', async () => {
    api.get.mockImplementation(async (_route: string, options: any) => { if (options.params.page === 2) throw new Error('Denied'); return { ...fixture(), total: 101, totalPages: 2, pageSize: 100, page: options.params.page, rows: Array.from({ length: 100 }, (_, i) => ({ ...fixture().rows[0], id: 'row-' + i })) }; });
    await act(async () => { await action().onClick() }); expect(mockOpen).not.toHaveBeenCalled(); expect(mockDialog).toHaveBeenCalled();
  });
  it('invalidates the print snapshot after a failed refresh', async () => {
    api.get.mockRejectedValueOnce(new Error('Denied')); await act(async () => { await mockActions.find(item => item.id === 'refresh').onClick() });
    expect(action().enabled).toBe(false); await act(async () => { await action().onClick() }); expect(mockOpen).not.toHaveBeenCalled();
  });
});
