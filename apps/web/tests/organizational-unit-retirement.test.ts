import { getUnifiedSearchRegistry } from '../src/components/f9/adapter-registry';
import { organizationalUnitAdapter } from '../src/components/f9/lookup-adapters';
import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const fileExists = (rel: string) => fs.existsSync(path.join(webRoot, rel));
const read = (rel: string) => fs.readFileSync(path.join(webRoot, rel), 'utf8');

const NAV = 'src/components/admin/shell/navigation-data.ts';

describe('OrganizationalUnit navigation retirement', () => {
  describe('A. sidebar no longer contains Organizational Units', () => {
    it('the navigation route entry is absent', () => {
      const nav = read(NAV);
      expect(nav).not.toContain('/admin/core/organizational-units');
      expect(nav).not.toContain('org-organizational-units');
      expect(nav).not.toContain("labelKey: 'navigation.organizationalUnits'");
    });
  });

  describe('B. global unified search registry no longer contains OrganizationalUnit', () => {
    it('registry has no organizationalUnit entity', () => {
      const types = getUnifiedSearchRegistry().map((e) => e.entityType);
      expect(types).not.toContain('organizationalUnit');
      expect(types).not.toContain('organizational-units');
    });
  });

  describe('C. direct OU route is preserved as a compatibility/admin recovery page', () => {
    it('keeps the list page and it still calls the real API', () => {
      const page = read('src/app/admin/core/organizational-units/page.tsx');
      expect(page).toContain('/organizational-units');
      expect(page).toContain('api.get');
      expect(page).toContain('api.post');
      expect(page).toContain('api.patch');
    });

    it('keeps the detail page and it still builds a real edit path', () => {
      const detail = read('src/app/admin/core/organizational-units/[id]/page.tsx');
      expect(detail).toContain('api.get');
      expect(detail).toContain('api.patch');
    });

    it('route files exist on disk', () => {
      expect(fileExists('src/app/admin/core/organizational-units/page.tsx')).toBe(true);
      expect(fileExists('src/app/admin/core/organizational-units/[id]/page.tsx')).toBe(true);
    });
  });

  describe('D. organizationalUnitAdapter is preserved and usable by OU self-pages', () => {
    it('adapter still exists and targets the OU endpoint', () => {
      expect(organizationalUnitAdapter).toBeDefined();
      expect(organizationalUnitAdapter.endpoint).toBe('/organizational-units');
      expect(typeof organizationalUnitAdapter.displayLabel).toBe('function');
    });

    it('adapter is still re-exported from the f9 barrel for OU self-pages', () => {
      expect(read('src/components/f9/index.ts')).toContain('organizationalUnitAdapter');
    });
  });

  describe('E. Department navigation remains unchanged', () => {
    it('departments route and permission still present in nav data', () => {
      const nav = read(NAV);
      expect(nav).toContain("route: '/admin/core/departments'");
      expect(nav).toContain("permission: 'department:read'");
    });
  });

  describe('F. no other navigation regression', () => {
    const expected = [
      '/admin/core/companies',
      '/admin/core/branches',
      '/admin/core/administrations',
      '/admin/core/departments',
      '/admin/core/persons',
      '/admin/core/job-titles',
      '/admin/core/person-assignments',
      '/admin/core/supervisor-assignments',
    ];

    it('all neighboring org-structure entries remain present', () => {
      const nav = read(NAV);
      for (const route of expected) {
        expect(nav).toContain(route);
      }
    });

    it('dashboard root group is still declared', () => {
      const nav = read(NAV);
      expect(nav).toContain("id: 'dashboard'");
      expect(nav).toContain("route: '/admin/dashboard'");
    });
  });
});
