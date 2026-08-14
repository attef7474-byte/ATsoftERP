import { api, getApiBaseUrl } from './api';
import {
  clearStoredOperationalContext,
  normalizeOperationalContext,
  normalizeOperationalContextsResponse,
} from './operational-context';
import type {
  OperationalContext,
  OperationalContextIdentity,
  OperationalContextsResult,
} from './operational-context';

export type {
  OperationalContext,
  OperationalContextIdentity,
  OperationalContextsResult,
} from './operational-context';

export interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; name: string };
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  status: string;
  companyId?: string | null;
  branchId?: string | null;
  administrationId?: string | null;
  departmentId?: string | null;
  allowedContexts?: OperationalContext[];
  defaultContext?: OperationalContext | null;
  activeContext?: OperationalContext | null;
  lastLoginAt?: string | null;
  createdAt: string;
  roles: { role: { id: string; code: string; name: string } }[];
}

export interface UserPermissions {
  roles: { id: string; code: string; name: string }[];
  permissions: string[];
  isSuperAdmin: boolean;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const result = await api.post<LoginResponse>('/auth/login', { email, password });
  if (result.accessToken) {
    clearStoredOperationalContext();
    localStorage.setItem('accessToken', result.accessToken);
  }
  return result;
}

export async function getProfile(): Promise<UserProfile> {
  return api.get<UserProfile>('/auth/me', { skipOperationalContext: true });
}

export async function getUserPermissions(): Promise<UserPermissions> {
  return api.get<UserPermissions>('/auth/permissions', { skipOperationalContext: true });
}

export async function getOperationalContexts(): Promise<OperationalContextsResult> {
  const response = await api.get<unknown>('/auth/contexts', { skipOperationalContext: true });
  return normalizeOperationalContextsResponse(response);
}

export async function validateOperationalContext(
  context: OperationalContextIdentity,
): Promise<OperationalContext> {
  const response = await api.post<unknown>(
    '/auth/context/validate',
    context,
    { skipOperationalContext: true },
  );
  const outer = response !== null && typeof response === 'object'
    ? response as Record<string, unknown>
    : {};
  const source = outer.data !== null && typeof outer.data === 'object'
    ? outer.data as Record<string, unknown>
    : outer;
  if (source.valid === false) {
    const error = new Error(typeof source.message === 'string' ? source.message : '');
    Object.assign(error, { code: 'INVALID_OPERATIONAL_CONTEXT' });
    throw error;
  }
  return normalizeOperationalContext(source.context ?? source.activeContext ?? context) ?? {
    companyId: context.companyId,
    branchId: context.branchId,
    administrationId: context.administrationId,
    departmentId: context.departmentId,
  };
}

export function logout(userId?: string): void {
  localStorage.removeItem('accessToken');
  clearStoredOperationalContext(userId);
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

export function registerAutoLogout(): () => void {
  const handler = () => {
    const token = getToken();
    if (!token) return;
    const baseUrl = getApiBaseUrl();
    navigator.sendBeacon(`${baseUrl}/auth/logout`, JSON.stringify({}));
    localStorage.removeItem('accessToken');
    clearStoredOperationalContext();
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}

export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('accessToken');
  }
  return null;
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
