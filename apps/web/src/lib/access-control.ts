import { api } from './api';
import { UserPermissions } from './auth';

export async function fetchUserPermissions(): Promise<UserPermissions> {
  return api.get<UserPermissions>('/auth/permissions');
}

export function hasPermission(permissions: string[], required: string): boolean {
  return permissions.includes(required);
}

export function hasAnyPermission(permissions: string[], required: string[]): boolean {
  return required.some((r) => permissions.includes(r));
}

export function hasAllPermissions(permissions: string[], required: string[]): boolean {
  return required.every((r) => permissions.includes(r));
}
