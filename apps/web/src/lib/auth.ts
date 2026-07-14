import { api } from './api';

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
  departmentId?: string | null;
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
    localStorage.setItem('accessToken', result.accessToken);
  }
  return result;
}

export async function getProfile(): Promise<UserProfile> {
  return api.get<UserProfile>('/auth/me');
}

export async function getUserPermissions(): Promise<UserPermissions> {
  return api.get<UserPermissions>('/auth/permissions');
}

export function logout(): void {
  localStorage.removeItem('accessToken');
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
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
