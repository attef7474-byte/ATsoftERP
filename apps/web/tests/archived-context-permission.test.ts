import * as fs from 'fs';
import * as path from 'path';
import {
  ARCHIVE_MUTATING_ACTIONS,
  ARCHIVE_READ_ONLY_ACTIONS,
  ARCHIVE_READ_PERMISSION,
  ARCHIVED_CONTEXT_MODE_HEADER,
  ARCHIVED_CONTEXT_MODE_VALUE,
  canBrowseArchivedContexts,
  filterArchivePermissions,
  getPermissionAction,
  isArchiveReadOnlyPermission,
  superAdminArchiveReadPermissions,
} from '../src/lib/archived-context';
import {
  clearStoredArchivedContext,
  getArchivedStorageKey,
  getOperationalContextHeaders,
  setStoredArchivedContext,
  ARCHIVED_CONTEXT_MODE_HEADER as OP_MODE_HEADER,
  ARCHIVED_CONTEXT_MODE_VALUE as OP_MODE_VALUE,
} from '../src/lib/operational-context';
import type { OperationalContextIdentity } from '../src/lib/operational-context';
import { AUTHORITATIVE_PERMISSION_KEYS } from './permission-catalogue-data';

const identity = (
  companyId: string,
  branchId: string | null = null,
  administrationId: string | null = null,
  departmentId: string | null = null,
): OperationalContextIdentity => ({ companyId, branchId, administrationId, departmentId });

const readSrc = (relative: string) =>
  fs.readFileSync(path.join(__dirname, '..', 'src', relative), 'utf-8');

const UNIQUE_ACTIONS = Array.from(
  new Set(AUTHORITATIVE_PERMISSION_KEYS.map(getPermissionAction)),
);

describe('archive read-only action classification (fail-closed)', () => {
  it('classifies every authoritative permission action as read-only or mutating', () => {
    const unclassified = UNIQUE_ACTIONS.filter(
      (action) =>
        !ARCHIVE_READ_ONLY_ACTIONS.has(action) && !ARCHIVE_MUTATING_ACTIONS.has(action),
    );
    expect(unclassified).toEqual([]);
  });

  it('keeps the read-only and mutating sets disjoint', () => {
    const overlap = ARCHIVE_READ_ONLY_ACTIONS
      ? Array.from(ARCHIVE_READ_ONLY_ACTIONS).filter((a) => ARCHIVE_MUTATING_ACTIONS.has(a))
      : [];
    expect(overlap).toEqual([]);
  });

  it('never treats state-changing actions as read-only', () => {
    const dangerous = [
      'create',
      'update',
      'delete',
      'approve',
      'post',
      'close-valuation',
      'transition',
      'override',
    ].filter((a) => ARCHIVE_READ_ONLY_ACTIONS.has(a));
    expect(dangerous).toEqual([]);
  });

  it('exposes the single archive browse permission', () => {
    expect(ARCHIVE_READ_PERMISSION).toBe('company:readArchive');
    expect(isArchiveReadOnlyPermission(ARCHIVE_READ_PERMISSION)).toBe(true);
    expect(filterArchivePermissions([ARCHIVE_READ_PERMISSION])).toEqual([
      ARCHIVE_READ_PERMISSION,
    ]);
  });

  it('drops mutating permissions and unknown future actions while browsing', () => {
    const projected = filterArchivePermissions([
      'company:read',
      'company:create',
      'company:update',
      'company:delete',
      'production-run:close-valuation',
      'branch:read',
      'branch:delete',
      'maintenance-request:create',
      'some-module:inventedFutureAction',
    ]);
    expect(projected).toEqual(['company:read', 'branch:read']);
  });

  it('keeps print/export/read summary permissions', () => {
    const projected = filterArchivePermissions([
      'production-order:print',
      'inventory:reports:export',
      'downtime-log:logSummary',
      'maintenance-request:history',
      'inventory:stock-card',
    ]);
    expect(projected).toHaveLength(5);
  });
  it('expands the SUPER_ADMIN bypass into read-only keys only', () => {
    const projected = superAdminArchiveReadPermissions();

    expect(projected).toContain('production-order:read');
    expect(projected).toContain('production-order:view');
    expect(projected).toContain('company:readArchive');
    expect(projected.every(isArchiveReadOnlyPermission)).toBe(true);
    expect(projected.some((key) => /:(create|update|delete|release|plan|close|archive)$/.test(key))).toBe(false);
    expect(projected.length).toBeGreaterThan(100);
  });

  it('keeps reads and drops mutations for a super admin projection in archive mode', () => {
    const effective = filterArchivePermissions([
      'production-order:plan',
      'company:create',
      ...superAdminArchiveReadPermissions(),
    ]);

    expect(effective).toContain('production-order:read');
    expect(effective).toContain('production-order:print');
    expect(effective).not.toContain('production-order:plan');
    expect(effective).not.toContain('company:create');
  });
});

describe('archive browse permission admission', () => {
  it('admits SUPER_ADMIN and explicit permission holders only', () => {
    expect(canBrowseArchivedContexts(null, true)).toBe(true);
    expect(canBrowseArchivedContexts([], true)).toBe(true);
    expect(canBrowseArchivedContexts([ARCHIVE_READ_PERMISSION], false)).toBe(true);
    expect(canBrowseArchivedContexts(['company:read'], false)).toBe(false);
    expect(canBrowseArchivedContexts(null, false)).toBe(false);
  });
});

describe('archived context request headers', () => {
  function installWindowStub(): Map<string, string> {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    };
    (globalThis as unknown as { window: unknown }).window = { localStorage: storage };
    return store;
  }

  beforeEach(() => {
    installWindowStub();
  });

  afterEach(() => {
    clearStoredArchivedContext();
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('derives the archive mode header from the stored archived selection only', () => {
    setStoredArchivedContext('user_1', {
      companyId: 'comp_archived',
      branchId: 'branch_archived',
      administrationId: 'adm_archived',
      departmentId: 'dept_archived',
    });

    const headers = getOperationalContextHeaders();
    expect(headers['x-active-company-id']).toBe('comp_archived');
    expect(headers['x-active-branch-id']).toBe('branch_archived');
    expect(headers[ARCHIVED_CONTEXT_MODE_HEADER]).toBe(ARCHIVED_CONTEXT_MODE_VALUE);
    expect(ARCHIVED_CONTEXT_MODE_HEADER).toBe(OP_MODE_HEADER);
    expect(ARCHIVED_CONTEXT_MODE_VALUE).toBe(OP_MODE_VALUE);
  });

  it('stores archived selection under a dedicated key that is not the active key', () => {
    setStoredArchivedContext('user_1', identity('comp_archived', 'branch_archived'));
    const key = getArchivedStorageKey('user_1');
    expect(key).toContain('archived-context.user.');
    expect(key).not.toContain('active-context.user.');
  });

  it('never emits the archive mode header for an explicit active context', () => {
    setStoredArchivedContext('user_1', identity('comp_archived', 'branch_archived'));
    const headers = getOperationalContextHeaders(
      identity('comp_active', 'branch_active'),
    );
    expect(headers['x-active-company-id']).toBe('comp_active');
    expect(headers[ARCHIVED_CONTEXT_MODE_HEADER]).toBeUndefined();
  });

  it('stops emitting the archive header after the selection is cleared', () => {
    setStoredArchivedContext('user_1', identity('comp_archived', 'branch_archived'));
    clearStoredArchivedContext('user_1');
    const headers = getOperationalContextHeaders();
    expect(headers[ARCHIVED_CONTEXT_MODE_HEADER]).toBeUndefined();
    expect(headers['x-active-company-id']).toBeUndefined();
  });
});

describe('archive mode UI wiring (source contract)', () => {
  it('projects effective permissions in the auth provider while browsing the archive', () => {
    const source = readSrc(path.join('lib', 'auth-context.tsx'));
    expect(source).toContain('filterArchivePermissions');
    expect(source).toContain('clearStoredArchivedContext');
    expect(source).toContain('enterArchiveMode');
    expect(source).toContain('exitArchiveMode');
  });

  it('hides non read-only admin action bar entries in archive mode', () => {
    const shell = readSrc(path.join('components', 'admin', 'shell', 'admin-shell.tsx'));
    expect(shell).toContain('action.readOnly === true');
    expect(shell).toContain('<ArchivedContextBanner');
    const bar = readSrc(path.join('components', 'admin', 'admin-action-bar.tsx'));
    expect(bar).toContain('readOnly?: boolean');
  });

  it('offers archive selection only through the operational context selector', () => {
    const selector = readSrc(
      path.join('components', 'admin', 'operational-context', 'context-selector.tsx'),
    );
    expect(selector).toContain('enterArchiveMode');
    expect(selector).toContain('exitArchiveMode');
    expect(selector).toContain('archivedKey');
  });

  it('adds no archive entry to the production sidebar navigation', () => {
    const nav = readSrc(
      path.join('components', 'admin', 'shell', 'navigation-data.ts'),
    );
    expect(nav).not.toMatch(/archive/i);
  });

  it('translates every archive key in both locales', () => {
    const en = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'lib', 'i18n', 'locales', 'en', 'common.ts'),
      'utf-8',
    );
    const ar = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'lib', 'i18n', 'locales', 'ar', 'common.ts'),
      'utf-8',
    );
    const keys = [
      'archivedTitle',
      'archivedHint',
      'archivedEmpty',
      'archivedBadge',
      'archivedReadOnlyBadge',
      'archivedCurrent',
      'enterArchived',
      'exitArchived',
      'bannerTitle',
      'bannerBody',
    ];
    for (const key of keys) {
      expect(en).toContain(`${key}:`);
      expect(ar).toContain(`${key}:`);
    }
  });
});
