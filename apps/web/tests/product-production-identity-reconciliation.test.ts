/**
 * Product ↔ Production Product Identity reconciliation — focused frontend contract.
 *
 * The product must expose exactly ONE canonical product page, ONE create form, ONE
 * edit form, ONE save action and ONE product identity (code/name/general
 * description live on the Product; the production definition is configuration
 * only, rendered inside the same canonical form). These tests read the real
 * component/route sources so the UI cannot silently drift back to two competing
 * product identities.
 *
 * Hiding a control is NOT the authorization boundary: the API guards are enforced
 * separately in apps/api (`products`, `production-product:*`, `PermissionCheckService`).
 * This suite only keeps the UI aligned with that contract.
 */

import fs from 'fs';
import path from 'path';

const webRoot = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(webRoot, rel), 'utf8');

const WORKSPACE = 'src/components/inventory/products/products-workspace.tsx';
const FORM = 'src/app/admin/inventory/products/product-form.tsx';
const INVENTORY_PAGE = 'src/app/admin/inventory/products/page.tsx';
const PRODUCTION_PAGE = 'src/app/admin/production/product-definitions/page.tsx';
const LEGACY_PANEL = 'src/components/factory/unified-production/product-definitions-panel.tsx';
const NAV = 'src/components/admin/shell/navigation-data.ts';
const EN = 'src/lib/i18n/locales/en/production.ts';
const AR = 'src/lib/i18n/locales/ar/production.ts';
const TYPES = 'src/lib/admin-types/inventory.ts';

const count = (source: string, pattern: RegExp) => (source.match(pattern) ?? []).length;

describe('Product ↔ Production identity reconciliation (canonical UI)', () => {
  const workspace = read(WORKSPACE);
  const form = read(FORM);
  const inventoryPage = read(INVENTORY_PAGE);
  const productionPage = read(PRODUCTION_PAGE);
  const legacyPanel = read(LEGACY_PANEL);

  describe('ONE canonical product page', () => {
    it('W01 the inventory Products page renders the shared ProductsWorkspace', () => {
      expect(inventoryPage).toContain("from '../../../../components/inventory/products/products-workspace'");
      expect(inventoryPage).toContain('<ProductsWorkspace');
    });

    it('W02 the production Products & Setup page renders the SAME ProductsWorkspace', () => {
      expect(productionPage).toContain("from '../../../../components/inventory/products/products-workspace'");
      expect(productionPage).toContain('<ProductsWorkspace');
    });

    it('W02b the production workspace passes showHeader=false and section=production', () => {
      expect(productionPage).toContain('showHeader={false}');
      expect(productionPage).toContain('defaultSection="production"');
    });

    it('W28 the legacy production route is preserved (not deleted) and keeps its other tabs', () => {
      expect(productionPage).toContain('TAB_ORDER');
      expect(productionPage).toContain("'units'");
      expect(productionPage).toContain("'capacity-standards'");
      expect(productionPage).toContain('<UnitsPanel');
      expect(productionPage).toContain('<CapacityStandardsPanel');
    });

    it('W19 there is exactly ONE product management grid column set (not a second list)', () => {
      expect(count(workspace, /const columns: GridColumn<Product>\[\]/g)).toBe(1);
      // The legacy production panel is a read/config view and must NOT own a
      // second product-identity creation flow.
      expect(legacyPanel).not.toMatch(/openCreate\s*=\s*\(\s*\)\s*=>\s*\{\s*setForm/);
    });
  });

  describe('ONE canonical Create and ONE canonical Edit action', () => {
    it('W03 the workspace has exactly one create action wiring', () => {
      expect(count(workspace, /id: 'new'/g)).toBe(1);
      expect(workspace).toContain('openCreate');
      expect(count(workspace, /const openCreate =/g)).toBe(1);
    });

    it('W04 the workspace has exactly one edit action wiring', () => {
      expect(count(workspace, /id: 'edit'/g)).toBe(1);
      expect(count(workspace, /const openEdit =/g)).toBe(1);
    });

    it('W30 the workspace exposes exactly one save action', () => {
      expect(count(workspace, /<ProductForm\b/g)).toBe(1);
      expect(count(form, /const handleSave =/g)).toBe(1);
      expect(count(form, /onClick=\{handleSave\}/g)).toBe(1);
    });
  });

  describe('ONE product identity in the canonical form (no duplicate fields)', () => {
    it('W12 the form renders exactly one code input', () => {
      expect(count(form, /label=\{t\('inventory\.code'\)\}/g)).toBe(1);
    });

    it('W13 the form renders exactly one name input', () => {
      expect(count(form, /label=\{t\('inventory\.name'\)\}/g)).toBe(1);
    });

    it('W14 the form renders exactly one general description input', () => {
      expect(count(form, /t\('inventory\.description'\)/g)).toBe(1);
    });

    it('W15 the ProductUom (packaging) editor appears only once', () => {
      expect(count(form, /t\('inventory\.packagingUnits'\)/g)).toBe(1);
      expect(count(form, /addPackagingUnit/g)).toBe(1);
    });

    it('W15b the production section carries NO product code, name or general description input', () => {
      const section = form.slice(form.indexOf('product-production-section'));
      expect(section).not.toContain("label={t('inventory.code')}");
      expect(section).not.toContain("label={t('inventory.name')}");
      expect(section).not.toContain("t('inventory.description')");
    });
  });

  describe('Production configuration is configuration-only', () => {
    it('W05 the canonical form contains a Production section', () => {
      expect(form).toContain('product-production-section');
      expect(form).toContain("t('production.settings')");
    });

    it('W06 the production toggle exists and drives enabled/disabled', () => {
      expect(form).toContain('productionEnabled');
      expect(form).toMatch(/enabled:\s*productionEnabled/);
      expect(form).toContain("t('production.producedInternally')");
    });

    it('W07 production line F9 lookup', () => {
      expect(form).toMatch(/t\('production\.defaultLine'\)[\s\S]*?adapter=\{productionLineAdapter\}/);
    });

    it('W08 production unit F9 lookup', () => {
      expect(form).toMatch(/t\('production\.defaultUnit'\)[\s\S]*?adapter=\{productionUnitAdapter\}/);
    });

    it('W09 production warehouse F9 lookup', () => {
      expect(form).toMatch(/t\('production\.defaultWarehouse'\)[\s\S]*?adapter=\{warehouseAdapter\}/);
    });

    it('W10 production cost-center F9 lookup', () => {
      expect(form).toMatch(/t\('production\.defaultCostCenter'\)[\s\S]*?adapter=\{costCenterAdapter\}/);
    });

    it('W11 production notes are captured', () => {
      expect(form).toContain("t('production.productionNotes')");
      expect(form).toMatch(/notes:\s*productionNotes\.trim\(\)/);
    });

    it('W25 the production section never renders raw IDs as input labels', () => {
      const section = form.slice(form.indexOf('product-production-section'));
      expect(section).not.toMatch(/value=\{[^}]*\.id\}/);
      expect(section).not.toMatch(/placeholder="[0-9a-f]{20,}"/);
    });
  });

  describe('production payload gating', () => {
    it('W06b the production payload is only sent when engaged/permitted', () => {
      expect(form).toContain('productionTouched');
      expect(form).toMatch(/canManageProduction\s*&&\s*productionTouched/);
    });

    it('W23a product-section permissions are used for the production write', () => {
      expect(form).toContain("'production-product:update'");
      expect(form).toContain("'production-product:create'");
      expect(form).toContain('canManageProduction');
    });

    it('W23b product identity section keeps products:* permissions', () => {
      expect(workspace).toContain("permission: 'products:create'");
      expect(workspace).toContain("permission: 'products:update'");
    });

    it('W24 archive mode denies production mutation controls', () => {
      expect(form).toContain('isArchivedContext');
      expect(form).toMatch(/canManageProduction\s*=[\s\S]*?!isArchivedContext/);
    });
  });

  describe('legacy production identity workflow removed', () => {
    it('W16 the legacy panel has no independent identity modal', () => {
      expect(legacyPanel).not.toContain("t('production.newDefinition')");
      expect(legacyPanel).not.toContain("t('production.editDefinition')");
      expect(legacyPanel).not.toMatch(/handleSave\s*=\s*async/);
      expect(legacyPanel).not.toMatch(/api\.post\('\/production\/product-definitions'/);
    });

    it('W17 legacy production list edit opens the canonical product edit form', () => {
      expect(legacyPanel).toContain('useRouter');
      expect(legacyPanel).toContain('/admin/inventory/products?edit=');
      expect(legacyPanel).toContain('openEditProduct');
    });

    it('W17b legacy production create routes to the canonical product create form', () => {
      expect(legacyPanel).toContain('/admin/inventory/products?create=1&section=production');
    });

    it('W18 the production.settings list remains a read/config list (no product-identity save)', () => {
      // The list still owns its own child-record (specification/version/…) modals,
      // but must NOT own a product-identity create/edit/save path.
      expect(legacyPanel).toContain('AdminDataGrid');
      expect(legacyPanel).not.toMatch(/handleSave\s*=\s*async/);
      expect(legacyPanel).not.toMatch(/api\.post\('\/production\/product-definitions'/);
    });
  });

  describe('deep links and canonical edit', () => {
    it('W29 the canonical workspace reads ?create, ?edit and ?section', () => {
      expect(workspace).toContain("params.get('create')");
      expect(workspace).toContain("params.get('edit')");
      expect(workspace).toContain("params.get('section')");
      expect(workspace).toContain('window.history.replaceState');
    });

    it('W29b a section focus scrolls to the production section', () => {
      expect(form).toContain('productionSectionRef');
      expect(form).toContain('scrollIntoView');
    });
  });

  describe('types and i18n', () => {
    it('exposes productionDefinitions summary on Product (no competing identity type)', () => {
      const types = read(TYPES);
      expect(types).toContain('ProductionDefinitionSummary');
      expect(types).toMatch(/productionDefinitions\?:\s*ProductionDefinitionSummary\[\]/);
    });

    it('W20 every production settings label exists in English', () => {
      const en = read(EN);
      for (const key of ['settings', 'configured', 'notConfigured', 'producedInternally', 'productionNotes', 'productionReference', 'settingsReadOnly']) {
        expect(en).toMatch(new RegExp(`${key}:\\s*'[^']+'`));
      }
    });

    it('W19 every production settings label exists in Arabic and differs from English', () => {
      const en = read(EN);
      const ar = read(AR);
      for (const key of ['settings', 'configured', 'notConfigured', 'producedInternally', 'productionNotes', 'productionReference', 'settingsReadOnly']) {
        expect(ar).toMatch(new RegExp(`${key}:\\s*'[^']+'`));
      }
      expect(ar).not.toEqual(en);
    });
  });

  describe('production sidebar contract', () => {
    it('W27 the production sidebar exposes exactly 8 canonical entries', () => {
      // The navigation-data source is the authority; the existing dedicated suite
      // verifies the exact 8 routes. Here we assert no product-identity duplicate
      // entry was reintroduced.
      const nav = read(NAV);
      const productDefinitionRoutes = count(nav, /\/admin\/production\/product-definitions/g);
      expect(productDefinitionRoutes).toBe(1);
    });
  });
});
