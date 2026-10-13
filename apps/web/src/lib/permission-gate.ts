/**
 * Single permission-visibility contract for the whole admin UI.
 *
 * The API's `PermissionsGuard` is the security boundary: it compares seeded keys with
 * an exact, case-sensitive `Set.has` and returns 403 otherwise. The UI uses this same
 * predicate only to decide what to *show*; it never replaces the backend check.
 *
 * - An action/item with no declared permission is available to every authenticated user.
 * - `SUPER_ADMIN` mirrors the API guard's bypass exactly.
 * - While the effective permission payload is still unresolved (`permissions === null`)
 *   protected entries are hidden (deny-by-default), so an unauthorized control is never
 *   flashed while permissions load. Unprotected entries stay visible.
 */
export function isPermissionGranted(
  permission: string | undefined | null,
  permissions: string[] | null,
  isSuperAdmin: boolean,
): boolean {
  if (!permission) return true;
  if (isSuperAdmin) return true;
  if (permissions === null) return false;
  return permissions.includes(permission);
}

/** Match the API guard: every listed permission must be held. */
export function canAll(
  permissions: string[] | null,
  required: string[],
  isSuperAdmin: boolean,
): boolean {
  if (isSuperAdmin) return true;
  if (permissions === null) return false;
  return required.every((key) => permissions.includes(key));
}

/** Match the API guard: any one of the listed permissions is enough. */
export function canAny(
  permissions: string[] | null,
  required: string[],
  isSuperAdmin: boolean,
): boolean {
  if (required.length === 0) return true;
  if (isSuperAdmin) return true;
  if (permissions === null) return false;
  return required.some((key) => permissions.includes(key));
}
