/**
 * Canonical permission-key registry for the web UI.
 *
 * Permission keys must stay byte-identical to the API `@Permissions(...)` guards
 * (the security boundary). Guard-protected pages must never embed these strings
 * literally, so the keys live here as a single source of truth and are imported
 * by reference. This module is pure data; it enforces nothing.
 */
export const PERMISSION_KEYS = {
  INSTALLED_PARTS_READ: 'installed-parts:read',
  INSTALLED_PARTS_CREATE: 'installed-parts:create',
  INSTALLED_PARTS_UPDATE: 'installed-parts:update',
  MAINTENANCE_RELIABILITY_READ: 'maintenance-reliability:read',
} as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS];
