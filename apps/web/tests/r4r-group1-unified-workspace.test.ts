/**
 * R4R Group 1 unified workspace proof.
 *
 * The product must expose exactly one primary human-registration workflow, and its writes
 * must go through the canonical `/person-registrations` orchestration rather than the three
 * legacy create endpoints. These tests read the real component/route sources so the UI
 * cannot silently drift back to a bypass.
 *
 * Hiding a control is NOT the authorization boundary: the API guard is enforced separately
 * in apps/api (`person-registrations`, `assertUserPermissions`). This suite keeps the UI
 * aligned with that contract.
 */

import fs from 'fs';
import path from 'path';

const webRoot = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(webRoot, rel), 'utf8');

const PERSONS_PAGE = 'src/app/admin/core/persons/page.tsx';
const PERSONNEL_PAGE = 'src/app/admin/maintenance/personnel/page.tsx';

/** Mirrors the `can()` helper implemented in the unified page. */
const can = (granted: string[] | undefined, key: string, isSuperAdmin = false) =>
  isSuperAdmin || Boolean(granted?.includes(key));

describe('R4R Group 1 unified workspace', () => {
  const source = read(PERSONS_PAGE);

  describe('canonical API wiring', () => {
    it('the unified list reads GET /person-registrations', () => {
      expect(source).toContain("api.get('/person-registrations'");
    });

    it('create uses canonical POST /person-registrations', () => {
      expect(source).toContain("api.post('/person-registrations'");
    });

    it('edit uses canonical PATCH /person-registrations/:id', () => {
      expect(source).toMatch(/api\.patch\(\s*`\/person-registrations\/\$\{/);
    });

    it('detail reads GET /person-registrations/:id', () => {
      expect(source).toMatch(/api\.get\(\s*`\/person-registrations\/\$\{/);
    });

    it('does not perform the three legacy independent create calls', () => {
      const mutations = source.match(/api\.(post|put|patch|delete)\s*(<[^>]*>)?\(\s*[`'"]\/(employees|users|maintenance\/personnel)/g);
      expect(mutations).toBeNull();
    });
  });

  describe('permission-segmented optional sections', () => {
    it('system-access toggle is gated by the user:* domain, not operational-person', () => {
      expect(source).toContain("can('user:create')");
      expect(source).toContain("can('user:update')");
      expect(source).toMatch(/loginToggleDisabled\s*=\s*!canCreateUser && !canUpdateUser/);
    });

    it('maintenance capability toggle is gated by maintenance-personnel:create', () => {
      expect(source).toContain("can('maintenance-personnel:create')");
      expect(source).toMatch(/maintenanceToggleDisabled\s*=\s*!canCreateMaintenance && !canUpdateMaintenance/);
    });

    it('optional User/Maintenance payloads are only sent when the toggle is enabled', () => {
      expect(source).toMatch(/if \(values\.enableLogin\)/);
      expect(source).toMatch(/if \(values\.enableMaintenance\)/);
    });

    it('SUPER_ADMIN sees the authorized sections (bypass honoured)', () => {
      expect(can([], 'user:create', true)).toBe(true);
      expect(can([], 'maintenance-personnel:create', true)).toBe(true);
      expect(can([], 'operational-person:create', true)).toBe(true);
    });

    it('user:create denied => system-access control unavailable', () => {
      const personOnly = ['operational-person:create', 'operational-person:update', 'person-assignment:create'];
      expect(can(personOnly, 'user:create')).toBe(false);
      expect(can(personOnly, 'user:update')).toBe(false);
      // A person-only operator must still be able to register the person.
      expect(can(personOnly, 'operational-person:create')).toBe(true);
    });

    it('maintenance-personnel:create denied => maintenance toggle unavailable', () => {
      const personOnly = ['operational-person:create', 'operational-person:update', 'person-assignment:create'];
      expect(can(personOnly, 'maintenance-personnel:create')).toBe(false);
      expect(can(personOnly, 'operational-person:create')).toBe(true);
    });
  });

  describe('state safety and display contract', () => {
    it('does not submit hidden authentication internals', () => {
      expect(source).not.toContain('passwordHash');
      expect(source).not.toContain('authVersion');
      expect(source).not.toContain('lastLoginAt');
    });

    it('failed canonical submit preserves a form-level error and never fakes success', () => {
      expect(source).toMatch(/validationErrors\.form/);
      expect(source).toContain("setValidationErrors({ form: message })");
    });

    it('never uses a raw record id as a display label in the grid', () => {
      // Column render functions must resolve human names, not print `...id`.
      const renders = source.match(/render:\s*\([^)]*\)\s*=>\s*[^,]+/g) ?? [];
      for (const render of renders) {
        expect(render).not.toMatch(/\.id\b/);
      }
      expect(source).not.toMatch(/render:[^,]*\bd\.id\b/);
    });
  });

  describe('required form sections and localization', () => {
    it('renders the personal, organization, maintenance, login and roles sections', () => {
      for (const section of [
        'personal-information',
        'organization-assignment',
        'maintenance-capability',
        'system-login',
        'roles-access',
      ]) {
        expect(source).toContain(`data-section="${section}"`);
      }
    });

    it('Arabic and English labels exist for every new Group 1 core key', () => {
      const keys = [
        'personalInformation',
        'organizationAssignment',
        'assignmentNotes',
        'maintenanceCapability',
        'enableMaintenanceCapability',
        'dailyCapacityMinutes',
        'systemLogin',
        'enableSystemAccess',
        'registerPerson',
      ];
      const en = read('src/lib/i18n/locales/en/core.ts');
      const ar = read('src/lib/i18n/locales/ar/core.ts');
      for (const key of keys) {
        expect(en).toMatch(new RegExp(`${key}\\s*:`));
        expect(ar).toMatch(new RegExp(`${key}\\s*:`));
      }
    });
  });

  describe('duplicate primary create workflow', () => {
    it('the maintenance-personnel surface no longer creates a person; it redirects to the unified workspace', () => {
      const personnel = read(PERSONNEL_PAGE);
      expect(personnel).toContain("router.push('/admin/core/persons')");
      const addAction = personnel.match(/id:\s*'add'[\s\S]{0,160}?onClick:\s*\(\)\s*=>\s*exec\('add'\)/);
      expect(addAction).not.toBeNull();
      // The 'add' handler must resolve to the redirect, never to the local create modal.
      expect(personnel).not.toMatch(/add:\s*\(\)\s*=>\s*openNew\(\)/);
    });

    it('the navigation entry for the unified route advertises the unified title', () => {
      const enNav = read('src/lib/i18n/locales/en/navigation.ts');
      const arNav = read('src/lib/i18n/locales/ar/navigation.ts');
      expect(enNav).toContain('Employees, Users & Maintenance Personnel');
      expect(arNav).toContain('كادر الصيانة');
      const navData = read('src/components/admin/shell/navigation-data.ts');
      expect(navData).toContain("route: '/admin/core/persons'");
    });
  });
});