import React from 'react';
import { randomBytes } from 'crypto';
import { personRegistrationErrors } from '../src/lib/person-registration-validation';

// Use the real page, React state, save hook, API error adapter and error handler.
// Only provider boundaries, DOM focus and unrelated lookup/table rendering are isolated.
const { act, create } = require('react-test-renderer');
let mockCrud: any;
let mockContext: any = { companyId: 'company-1', branchId: 'branch-1', companyName: 'رينجو', branchName: 'صنعاء' };
let mockIsSuperAdmin = true;
const mockToast = jest.fn(), mockDialog = jest.fn(), mockFocus = jest.fn();
const mockT = (key: string): string => ({
  'actions.save': 'حفظ', 'actions.cancel': 'إلغاء', 'common.create': 'إنشاء',
  'common.edit': 'تعديل', 'common.successCreated': 'تم الإنشاء بنجاح',
  'validation.required': 'هذا الحقل مطلوب', 'errors.validationFailed': 'تحقق من البيانات',
  'core.personRegistrationContextMismatch': 'الفرع لا يطابق السياق النشط',
  'errors.serverError': 'حدث خطأ في الخادم', 'errors.generalError': 'تعذر إكمال العملية',
  'errors.networkError': 'تعذر الاتصال بالخادم',
  'errorDialog.title': 'خطأ',
} as Record<string, string>)[key] || key;

jest.mock('../src/lib/i18n/use-translation', () => ({ useTranslation: () => ({ t: mockT, dir: 'rtl' }) }));
jest.mock('../src/hooks/useCrudList', () => {
  const actual = jest.requireActual('../src/hooks/useCrudList');
  return { ...actual, useCrudList: (options: any) => (mockCrud = actual.useCrudList(options)) };
});
jest.mock('../src/lib/auth-context', () => ({ useAuth: () => ({ isSuperAdmin: mockIsSuperAdmin, permissions: { permissions: ['operational-person:create'] }, activeContext: mockContext }) }));
jest.mock('../src/components/admin/toast-provider', () => ({ useToast: () => ({ showToast: mockToast }) }));
jest.mock('../src/components/admin/error-modal', () => ({ useErrorModal: () => ({ showError: mockDialog }) }));
jest.mock('../src/lib/form-validation', () => ({
  ...jest.requireActual('../src/lib/form-validation'), focusFirstInvalidField: (...args: any[]) => mockFocus(...args),
}));
jest.mock('../src/components/admin/admin-action-bar', () => ({
  useRegisterAdminActions: () => {}, useStableHandlers: (handlers: any) => ({ exec: (name: string) => handlers[name]() }),
  ActionAddIcon: () => null, ActionEditIcon: () => null, ActionRefreshIcon: () => null,
}));
jest.mock('../src/components/entity', () => ({
  EntityWorkspaceLayout: ({ children }: any) => React.createElement('main', null, children),
  EntityPageHeader: () => null, EntityDataTable: () => null, EntityEmptyState: () => null,
}));
jest.mock('../src/components/f9', () => ({
  F9Lookup: (props: any) => React.createElement('input', props),
  branchAdapter: {}, departmentAdapter: {}, jobTitleAdapter: {}, administrationAdapter: {},
}));
jest.mock('../src/components/admin/ui', () => ({
  Button: jest.requireActual('../src/components/admin/ui/button').Button,
  Input: jest.requireActual('../src/components/admin/ui/input').Input,
  Modal: ({ open, children }: any) => open ? React.createElement('div', { role: 'dialog' }, children) : null,
  Pagination: () => null, LoadingState: () => null,
}));
jest.mock('../src/app/admin/core/persons/enable-login-dialog', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/lib/api', () => {
  const actual = jest.requireActual('../src/lib/api');
  return { ...actual, api: { ...actual.api, get: jest.fn(async () => ({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } })) } };
});
const Page = require('../src/app/admin/core/persons/page').default;
const api = require('../src/lib/api').api;

describe('unified employee registration Save feedback', () => {
  let tree: any;
  const originalFetch = global.fetch;
  const text = () => JSON.stringify(tree.toJSON());
  const save = () => tree.root.findAllByType('button').find((b: any) => b.children.includes('حفظ'));
  const respond = (status: number, body: object) => {
    global.fetch = jest.fn(async () => ({ ok: status < 400, status, headers: { get: () => 'application/json' }, json: async () => body })) as any;
  };
  async function open(overrides: Record<string, unknown> = {}) {
    await act(async () => { tree = create(React.createElement(Page)); });
    await act(async () => { mockCrud.openCreate(); });
    await act(async () => { mockCrud.setForm({ ...mockCrud.form, name: ' Employee Full Name Here ', phone: '077174907', departmentId: 'department-1', enableLogin: true, loginEmail: 'employee@example.test', loginPassword: randomBytes(24).toString('base64'), roleIds: ['role-id-1'], ...overrides }); });
  }
  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = { companyId: 'company-1', branchId: 'branch-1', companyName: 'رينجو', branchName: 'صنعاء' };
    mockIsSuperAdmin = true;
    respond(400, {});
  });
  afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = undefined; global.fetch = originalFetch; });

  it.each(['password', 'login.password'])('renders the real password-policy response for %s, preserves input, and allows retry', async (field) => {
    const message = 'يجب ألا يقل طول كلمة المرور عن 10 أحرف';
    respond(400, { message: ['فشل التحقق من صحة البيانات'], messageKey: 'common.validationFailed', errors: [{ field, code: 'validation.passwordMinLength', message, params: { min: '10' } }] });
    await open(); const before = { ...mockCrud.form };
    await act(async () => { await save().props.onClick(); });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(text()).toContain(message);
    expect(tree.root.findAllByType('input').find((input: any) => input.props.id === 'loginPassword').props['aria-invalid']).toBe(true);
    expect(mockCrud.form).toEqual(before);
    expect(mockCrud.modalOpen).toBe(true); expect(mockCrud.saving).toBe(false);
    expect(mockDialog).toHaveBeenCalledWith(expect.objectContaining({ message: 'فشل التحقق من صحة البيانات' }));
    expect(mockFocus).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ field: 'loginPassword' })]));
  });

  it.each([
    ['login.email', 'loginEmail', 'البريد الإلكتروني مستخدم بالفعل.'],
    ['email', 'email', 'البريد الإلكتروني غير صالح'],
    ['placement.departmentId', 'departmentId', 'القسم لا يتبع الشركة النشطة'],
    ['placement.branchId', 'branchId', 'الفرع غير صالح'],
    ['placement.effectiveFrom', 'effectiveFrom', 'تاريخ غير صالح'],
    ['login.roleIds', 'roleIds', 'الدور غير صالح'],
    ['maintenance.role', 'maintenanceRole', 'دور الصيانة مطلوب'],
    ['unknown.server.path', 'unknown.server.path', 'تعذر التحقق من المرجع'],
  ])('keeps %s visible even when DTO paths differ from form fields', async (field, _control, message) => {
    respond(400, { message: ['فشل التحقق من صحة البيانات'], errors: [{ field, message }] });
    await open(); await act(async () => { await save().props.onClick(); });
    expect(text()).toContain(message); expect(mockCrud.modalOpen).toBe(true); expect(mockCrud.saving).toBe(false);
  });

  it.each([
    [401, 'يرجى تسجيل الدخول'], [403, 'لا تملك الصلاحية أو السياق للإنشاء'],
    [404, 'المرجع غير موجود'], [409, 'البريد الإلكتروني مستخدم بالفعل.'],
    [422, 'البيانات غير مقبولة'], [500, 'حدث خطأ داخلي، يرجى المحاولة لاحقًا'],
  ])('displays HTTP %i including its reference ID instead of swallowing it', async (status, message) => {
    respond(status, { statusCode: status, message: [message], messageKey: 'common.internalError', requestId: 'operation-reference-1' });
    await open(); await act(async () => { await save().props.onClick(); });
    expect(text()).toContain(message);
    expect(mockDialog).toHaveBeenCalledWith(expect.objectContaining({ message, requestId: 'operation-reference-1' }));
    expect(mockCrud.saving).toBe(false); expect(mockCrud.modalOpen).toBe(true);
  });

  it.each([['name', ''], ['departmentId', ''], ['loginEmail', ''], ['loginPassword', '']])('shows required %s before sending anything', async (field, value) => {
    await open({ [field]: value }); await act(async () => { await save().props.onClick(); });
    expect(global.fetch).not.toHaveBeenCalled(); expect(text()).toContain('هذا الحقل مطلوب');
  });

  it('keeps network failures visible and permits another Save without clearing input', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await open(); const before = { ...mockCrud.form };
    await act(async () => { await save().props.onClick(); });
    expect(text()).toContain('تعذر الاتصال بالخادم'); expect(mockDialog).toHaveBeenCalled();
    expect(mockCrud.form).toEqual(before); expect(mockCrud.saving).toBe(false); expect(save().props.disabled).toBeFalsy();
  });

  it('derives the branch from the active context and visibly blocks a different branch', async () => {
    await open(); expect(mockCrud.form.branchId).toBe('branch-1'); expect(text()).toContain('رينجو / صنعاء');
    await act(async () => mockCrud.setForm({ ...mockCrud.form, branchId: 'branch-other' }));
    await act(async () => { await save().props.onClick(); });
    expect(global.fetch).not.toHaveBeenCalled(); expect(text()).toContain('الفرع لا يطابق السياق النشط');
  });

  it('success closes the modal, refreshes the list, and sends one canonical ID-based aggregate', async () => {
    respond(201, { success: true, data: { id: 'created-person', code: 'AUTO-1', name: 'Employee' } });
    await open(); const initialLists = api.get.mock.calls.filter((c: any[]) => c[0] === '/person-registrations').length;
    await act(async () => { await save().props.onClick(); });
    expect(mockCrud.modalOpen).toBe(false); expect(mockCrud.saving).toBe(false);
    expect(mockToast).toHaveBeenCalledWith('تم الإنشاء بنجاح', 'success');
    expect(api.get.mock.calls.filter((c: any[]) => c[0] === '/person-registrations')).toHaveLength(initialLists + 1);
    const payload = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(payload.code).toBeUndefined(); expect(payload.name).toBe('Employee Full Name Here');
    expect(payload.login.roleIds).toEqual(['role-id-1']); expect(payload.maintenance).toBeUndefined();
    expect(payload.placement).toMatchObject({ branchId: 'branch-1', departmentId: 'department-1' });
  });

  it('prevents a second immediate click and shows disabled/loading until the request settles', async () => {
    let resolve: (value: unknown) => void = () => {};
    global.fetch = jest.fn(() => new Promise((r) => { resolve = r; })) as any;
    await open(); let first: Promise<void>, second: Promise<void>;
    await act(async () => { const click = save().props.onClick; first = click(); second = click(); });
    expect(global.fetch).toHaveBeenCalledTimes(1); expect(save().props.disabled).toBe(true);
    await act(async () => { resolve({ ok: true, status: 201, headers: { get: () => 'application/json' }, json: async () => ({ data: { id: 'new' } }) }); await first!; await second!; });
    expect(mockCrud.saving).toBe(false); expect(mockCrud.modalOpen).toBe(false);
  });

  it('does not send login or maintenance capabilities when disabled', async () => {
    respond(201, { data: { id: 'person-only' } });
    await open({ enableLogin: false, enableMaintenance: false, loginPassword: '' });
    await act(async () => { await save().props.onClick(); });
    const payload = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(payload.login).toBeUndefined(); expect(payload.maintenance).toBeUndefined();
  });

  it('does not load role grants for a personnel-only operator', async () => {
    mockIsSuperAdmin = false;
    await act(async () => { tree = create(React.createElement(Page)); });
    expect(api.get.mock.calls.some((call: any[]) => call[0] === '/roles')).toBe(false);
    expect(mockDialog).not.toHaveBeenCalled();
  });
});

it('combines policy failures and keeps fieldless failures without exposing raw codes', () => {
  expect(personRegistrationErrors([{ field: 'login.password', message: 'طويلة بما يكفي' }, { field: 'password', message: 'تحتوي على رقم' }, { code: 'unknown.internal.key' }], 'تحقق من البيانات')).toEqual({ fields: { loginPassword: 'طويلة بما يكفي تحتوي على رقم' }, summary: 'طويلة بما يكفي تحتوي على رقم تحقق من البيانات' });
});
