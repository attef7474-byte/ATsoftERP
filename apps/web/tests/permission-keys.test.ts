import {
  translatePermissionKey,
  translateRoleName,
  translateRoleDescription,
  translateEnum,
} from '../src/lib/i18n/literals';
import { Locale } from '../src/lib/i18n/types';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';

describe('raw permission key protection', () => {
  it('translates a raw permission key into a human EN label that does not contain the raw key', () => {
    const label = translatePermissionKey('administration:update', 'en');
    expect(label.toLowerCase()).not.toContain('administration:update');
    expect(label.toLowerCase()).toContain('update');
  });

  it('translates a raw permission key into a human AR label that does not contain the raw key', () => {
    const label = translatePermissionKey('administration:update', 'ar');
    expect(label).not.toContain('administration');
    expect(label).not.toContain(':update');
    expect(label).not.toContain('update');
  });

  it('does not expose raw keys for representative production permission keys', () => {
    const keys = ['attachment:read', 'maintenance:create', 'inventory:manage', 'settings.appearance.manage', 'numbering:generate'];
    for (const key of keys) {
      for (const locale of ['en', 'ar'] as Locale[]) {
        const label = translatePermissionKey(key, locale);
        expect(label.toLowerCase()).not.toContain(key.toLowerCase());
        expect(label).not.toMatch(/^[a-z]+[:/.]/);
      }
    }
  });

  it('never returns a raw key as the label', () => {
    const label = translatePermissionKey('whatever:nonsense', 'en');
    expect(label.toLowerCase()).not.toBe('whatever:nonsense');
  });

  it('returns a fallback for empty input', () => {
    expect(translatePermissionKey('', 'en')).toBe('-');
    expect(translatePermissionKey(undefined as unknown as string, 'en')).toBe('-');
  });
});

describe('system role display localization', () => {
  it('localizes the SUPER_ADMIN system role label for EN', () => {
    const label = translateRoleName('SUPER_ADMIN', 'Super Administrator', true, 'en');
    expect(label).toBe(en.access.roleSuperAdmin);
    expect(label).toBe('Super Administrator');
  });

  it('localizes the SUPER_ADMIN system role label for AR (no raw English stored name)', () => {
    const label = translateRoleName('SUPER_ADMIN', 'Super Administrator', true, 'ar');
    expect(label).toBe(ar.access.roleSuperAdmin);
    expect(label).not.toBe('Super Administrator');
    expect(label).not.toContain('Super');
  });

  it('localizes the SUPER_ADMIN system role description for EN and AR', () => {
    const enDesc = translateRoleDescription('SUPER_ADMIN', 'Full system access', true, 'en');
    expect(enDesc).toBe('Full system access');
    const arDesc = translateRoleDescription('SUPER_ADMIN', 'Full system access', true, 'ar');
    expect(arDesc).toBe(ar.access.roleSuperAdminDescription);
    expect(arDesc).not.toBe('Full system access');
  });

  it('preserves custom role name and description content unchanged (CUSTOM_ROLE_CONTENT_PRESERVED)', () => {
    const name = 'Warehouse Keeper';
    const desc = 'Manages stock movements';
    expect(translateRoleName('WAREHOUSE_KEEPER', name, false, 'en')).toBe(name);
    expect(translateRoleName('WAREHOUSE_KEEPER', name, false, 'ar')).toBe(name);
    expect(translateRoleDescription('WAREHOUSE_KEEPER', desc, false, 'en')).toBe(desc);
    expect(translateRoleDescription('WAREHOUSE_KEEPER', desc, false, 'ar')).toBe(desc);
  });

  it('falls back to the stored name for unknown system role codes', () => {
    const label = translateRoleName('UNKNOWN_SYSTEM', 'Some System Role', true, 'en');
    expect(label).toBe('Some System Role');
  });

  it('exposes both required locale keys for the SUPER_ADMIN role', () => {
    expect(en.access.roleSuperAdmin).toBeTruthy();
    expect(ar.access.roleSuperAdmin).toBeTruthy();
    expect(en.access.roleSuperAdminDescription).toBeTruthy();
    expect(ar.access.roleSuperAdminDescription).toBeTruthy();
  });
});

describe('access enum localization', () => {
  it('translates module values via translateEnum', () => {
    expect(translateEnum('administration', 'en', 'access').toLowerCase()).toContain('administration');
    expect(translateEnum('maintenance', 'ar', 'access')).toBeTruthy();
  });

  it('translates action values via translateEnum', () => {
    expect(translateEnum('update', 'en', 'actions').toLowerCase()).toBe('update');
    expect(translateEnum('delete', 'ar', 'actions')).toBeTruthy();
  });
});
