'use client';
import { useCallback, useMemo } from 'react';
import { useAuth } from './auth-context';

/**
 * Permission-aware tab contract for the consolidated Production workspaces.
 *
 * Every canonical workspace hosts several former standalone screens as tabs, and each
 * tab fronts a real API guarded by its own `*:read` permission. This hook makes the tab
 * bar mirror that contract: only tabs whose permission the principal holds are rendered,
 * and the workspace lands on the first authorized tab. It never replaces the backend
 * guard — it only decides what the operator can see and click.
 *
 * Deny-by-default while permissions are still loading (`permissions === null`) so an
 * unauthorized tab is never flashed, exactly like `permission-gate.ts`.
 */
export interface AuthorizedTabsOptions<T extends string> {
  /** Canonical display order. The first authorized id becomes the landing tab. */
  order: readonly T[];
  /** Permission key enforced by each tab's panel/API. */
  permissions: Record<T, string>;
}

export interface AuthorizedTabsResult<T extends string> {
  /** Auth context not resolved yet — render a loading state, never a tab. */
  loading: boolean;
  /** Authenticated but holds none of the tab permissions. */
  forbidden: boolean;
  can: (permission: string) => boolean;
  /** Authorized tab ids in canonical order. */
  visibleTabs: T[];
  /** Whether a tab id may be shown/selected. */
  isVisible: (id: string) => boolean;
}

export function useAuthorizedTabs<T extends string>({
  order,
  permissions: permissionsByTab,
}: AuthorizedTabsOptions<T>): AuthorizedTabsResult<T> {
  const { permissions, isSuperAdmin } = useAuth();

  const can = useCallback(
    (permission: string) => isSuperAdmin || (permissions?.permissions?.includes(permission) ?? false),
    [isSuperAdmin, permissions],
  );

  const visibleTabs = useMemo(
    () => order.filter((id) => can(permissionsByTab[id])),
    [order, permissionsByTab, can],
  );

  const isVisible = useCallback((id: string) => visibleTabs.includes(id as T), [visibleTabs]);

  return {
    loading: permissions === null,
    forbidden: permissions !== null && visibleTabs.length === 0,
    can,
    visibleTabs,
    isVisible,
  };
}

/**
 * Resolve the active tab: the requested tab when the principal may see it, otherwise
 * the first authorized tab (never an unauthorized one), otherwise the supplied
 * fallback while the visible set is still empty.
 */
export function resolveActiveTab<T extends string>(
  requested: string | null,
  visibleTabs: readonly T[],
  fallback: T,
): T {
  if (requested && (visibleTabs as readonly string[]).includes(requested)) return requested as T;
  return visibleTabs[0] ?? fallback;
}
