import React from 'react';
import { randomBytes } from 'crypto';
import { execFileSync } from 'child_process';
import path from 'path';
import { getApiBaseUrl, api } from '../src/lib/api';
import { login, getToken, getProfile } from '../src/lib/auth';
import { normalizeApiError } from '../src/lib/error-utils';

const { act, create } = require('react-test-renderer');
const mockPush = jest.fn(), mockShowError = jest.fn();
const mockT = (key: string) => ({ 'errors.networkError': 'تعذر الوصول إلى الخادم', 'errors.generalError': 'تعذر إكمال العملية', 'validation.required': 'هذا الحقل مطلوب', 'validation.email': 'البريد غير صالح' } as Record<string, string>)[key] || key;
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../src/lib/i18n/use-translation', () => ({ useTranslation: () => ({ t: mockT, locale: 'ar', setLocale: jest.fn() }) }));
jest.mock('../src/components/admin/error-modal', () => ({ useErrorModal: () => ({ showError: mockShowError }) }));
const { AuthProvider, useAuth } = require('../src/lib/auth-context');
const LoginPage = require('../src/app/login/page').default;

describe('desktop and LAN login transport', () => {
  const original = { window: (globalThis as any).window, document: (globalThis as any).document, storage: (globalThis as any).localStorage, fetch: global.fetch, api: process.env.NEXT_PUBLIC_API_URL };
  let storage: Map<string, string>;
  const token = () => randomBytes(32).toString('hex');
  function environment(origin: string) {
    const url = new URL(origin); storage = new Map();
    const localStorage = { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) };
    Object.assign(globalThis, { localStorage, window: { location: { protocol: url.protocol, hostname: url.hostname, origin: url.origin, href: url.href + 'login' }, localStorage, dispatchEvent: jest.fn() }, document: { cookie: '', documentElement: { lang: 'ar' } } });
  }
  const response = (status: number, body: unknown) => ({ ok: status < 400, status, headers: { get: () => 'application/json' }, json: async () => body });
  beforeEach(() => { jest.clearAllMocks(); delete process.env.NEXT_PUBLIC_API_URL; environment('http://192.168.8.156:3000'); });
  afterEach(() => { Object.assign(globalThis, { window: original.window, document: original.document, localStorage: original.storage, fetch: original.fetch }); if (original.api === undefined) delete process.env.NEXT_PUBLIC_API_URL; else process.env.NEXT_PUBLIC_API_URL = original.api; });

  it.each(['https://dell', 'http://192.168.8.156:3000', 'http://localhost:3000', 'http://another-lan-host:3000', 'https://192.168.8.156'])('keeps %s on the same browser origin', (origin) => {
    environment(origin); expect(getApiBaseUrl()).toBe('/api/v1');
    const request = new URL(getApiBaseUrl() + '/auth/login', origin);
    expect(request.origin).toBe(new URL(origin).origin); expect(request.pathname).toBe('/api/v1/auth/login');
  });

  it('preserves an explicit deployment override and keeps server-side fallback internal', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test/api/v1'; expect(getApiBaseUrl()).toBe('https://api.example.test/api/v1');
    delete process.env.NEXT_PUBLIC_API_URL; (globalThis as any).window = undefined; expect(getApiBaseUrl()).toBe('http://localhost:4000/api/v1');
  });

  it('executes the actual Next rewrite configuration without changing the API prefix or client hostname', () => {
    const config = path.resolve(__dirname, '../next.config.mjs');
    const script = 'const {pathToFileURL}=await import("node:url");const {default:c}=await import(pathToFileURL(process.argv[1]));console.log(JSON.stringify(await c.rewrites()));';
    const routes = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script, config], { encoding: 'utf8', windowsHide: true }));
    expect(routes).toEqual([{ source: '/api/v1/:path*', destination: 'http://127.0.0.1:4000/api/v1/:path*' }]);
    expect(new URL(routes[0].destination.replace(':path*', 'auth/login')).hostname).toBe('127.0.0.1');
    expect(routes[0].source).not.toContain(':host');
  });

  it.each(['https://dell', 'http://192.168.8.156:3000'])('persists the bearer token and authenticates a subsequent request on %s without cross-origin credentials', async (origin) => {
    environment(origin); const accessToken = token();
    global.fetch = jest.fn(async (url, options) => String(url).endsWith('/auth/login') ? response(201, { success: true, accessToken, user: { id: 'test-user' } }) : response(200, { id: 'test-user' })) as any;
    await login('controlled@example.test', token()); expect(getToken()).toBe(accessToken);
    await getProfile(); const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][0]).toBe('/api/v1/auth/login'); expect(calls[1][0]).toBe('/api/v1/auth/me');
    expect(calls[0][1].credentials).toBeUndefined();
    expect(new Headers(calls[1][1].headers).get('Authorization')).toBe('Bearer ' + accessToken);
    expect((globalThis as any).document.cookie).toBe('');
  });

  it.each([400, 401, 403, 422, 500])('preserves HTTP %i as an application error rather than a network failure', async (status) => {
    const message = status === 401 ? 'البريد أو كلمة المرور غير صحيحة' : 'رسالة رفض من الخادم';
    global.fetch = jest.fn(async () => response(status, { message: [message], messageKey: 'auth.invalidCredentials', requestId: 'reference-id' })) as any;
    let error: any; try { await login('controlled@example.test', token()); } catch (e) { error = e; }
    expect(error.status).toBe(status); const config = normalizeApiError(error, mockT);
    expect(config.message).toBe(message); expect(config.message).not.toBe('تعذر الوصول إلى الخادم'); expect(config.requestId).toBe('reference-id');
    expect(getToken()).toBeNull();
  });

  it('classifies a failed fetch as server access/network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    let error: any; try { await api.post('/auth/login', {}); } catch (e) { error = e; }
    expect(normalizeApiError(error, mockT).message).toBe('تعذر الوصول إلى الخادم');
  });

  it('the real Login page and AuthProvider navigate after success and restore the persisted session', async () => {
    const accessToken = token();
    global.fetch = jest.fn(async (url) => {
      if (String(url).endsWith('/auth/login')) return response(201, { accessToken, user: { id: 'test-user' } });
      if (String(url).endsWith('/auth/me')) return response(200, { id: 'test-user', roles: [], status: 'ACTIVE' });
      if (String(url).endsWith('/auth/permissions')) return response(200, { roles: [], permissions: [], isSuperAdmin: false });
      return response(200, { contexts: [], defaultContext: null });
    }) as any;
    let tree: any; await act(async () => { tree = create(React.createElement(AuthProvider, null, React.createElement(LoginPage))); });
    await act(async () => { tree.root.findByProps({ id: 'email' }).props.onChange({ target: { value: 'controlled@example.test' } }); tree.root.findByProps({ id: 'password' }).props.onChange({ target: { value: token() } }); });
    await act(async () => { await tree.root.findByType('form').props.onSubmit({ preventDefault: jest.fn() }); });
    expect(mockPush).toHaveBeenCalledWith('/admin/dashboard'); expect(getToken()).toBe(accessToken); expect(mockShowError).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
    let restored: any; const Consumer = () => { restored = useAuth(); return null; };
    await act(async () => { tree = create(React.createElement(AuthProvider, null, React.createElement(Consumer))); });
    expect(restored.user.id).toBe('test-user'); expect(restored.loading).toBe(false);
    await act(async () => tree.unmount());
  });
});
