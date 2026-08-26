import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getApiBaseUrl } from '../src/lib/api';
import { translatePermissionKey } from '../src/lib/i18n/literals';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';

function source(path: string): string {
  return readFileSync(resolve(__dirname, '..', path), 'utf8');
}

describe('production authentication recovery frontend contract', () => {
  it('uses same-origin /api/v1 for the approved HTTPS production path', () => {
    const previousWindow = (globalThis as any).window;
    const previousApiUrl = process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    (globalThis as any).window = {
      location: { protocol: 'https:', hostname: 'DELL' },
    };
    try {
      expect(getApiBaseUrl()).toBe('/api/v1');
    } finally {
      (globalThis as any).window = previousWindow;
      if (previousApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
      else process.env.NEXT_PUBLIC_API_URL = previousApiUrl;
    }
  });

  it('preserves the API prefix in the source-controlled Caddy route', () => {
    const caddyInstaller = source('../../deploy/windows/install-caddy-https.ps1');
    expect(caddyInstaller).toContain('handle /api/*');
    expect(caddyInstaller).not.toContain('handle_path /api/*');
  });

  it('gates reset UX by the explicit permission and never renders secret output', () => {
    const detailPage = source('src/app/admin/access/users/[id]/page.tsx');
    expect(detailPage).toContain("permissions?.permissions.includes('user:reset-password')");
    expect(detailPage).toContain('user.id !== currentUser.id');
    expect(detailPage).toContain('type="password"');
    expect(detailPage).toContain('autoComplete="new-password"');
    expect(detailPage).toContain('`/users/${id}/reset-password`');
    expect(detailPage).not.toMatch(/passwordHash|accessToken/);
  });

  it('uses the runtime policy and removes the obsolete hard-coded minimum of six', () => {
    const selfChangePage = source('src/app/admin/profile/password/page.tsx');
    const securitySettingsPage = source('src/app/admin/settings/security/page.tsx');
    expect(selfChangePage).toContain('getPasswordPolicy');
    expect(selfChangePage).not.toMatch(/length\s*<\s*6/);
    expect(securitySettingsPage).toContain('passwordMinLength');
    expect(securitySettingsPage).toContain('passwordRequireSymbol');
    expect(securitySettingsPage).not.toContain('requireSpecialChars: false');
  });

  it('calls the authenticated logout endpoint before clearing the local session', () => {
    const authClient = source('src/lib/auth.ts');
    const serverLogout = authClient.indexOf("api.post('/auth/logout'");
    const localClear = authClient.indexOf('clearLocalSession(userId)', serverLogout);
    expect(serverLogout).toBeGreaterThan(-1);
    expect(localClear).toBeGreaterThan(serverLogout);
  });

  it('has synchronized Arabic and English reset labels with no raw permission key', () => {
    expect(en.users.resetPassword).toBeTruthy();
    expect(ar.users.resetPassword).toBeTruthy();
    expect(en.users.passwordResetSuccess).toBeTruthy();
    expect(ar.users.passwordResetSuccess).toBeTruthy();
    expect(translatePermissionKey('user:reset-password', 'en')).toContain('Reset Password');
    expect(translatePermissionKey('user:reset-password', 'ar')).toContain('إعادة تعيين كلمة المرور');
  });
});
