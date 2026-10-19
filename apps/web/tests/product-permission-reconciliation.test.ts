/**
 * ATsoftERP — Product permission catalog & role reconciliation (frontend contract).
 *
 * These tests keep the UI aligned with the reconciled permission catalog: the canonical
 * plural `products:*` keys must gate the Product surface, the production configuration
 * authority (`production-product:*`) must stay separate from product identity authority,
 * the archived context must be read-only, and the Production sidebar must stay at exactly
 * eight workspaces.
 *
 * Hiding a control is NOT the authorization boundary: the API guards remain authoritative
 * (products.controller, product-categories.controller, production-product-definitions
 * controller, and ProductAggregateService's secondary-permission assertion).
 */

import fs from 'fs';
import path from 'path';

const webRoot = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(webRoot, rel), 'utf8');
const count = (source: string, pattern: RegExp) => (source.match(pattern) ?? []).length;

const WORKSPACE = 'src/components/inventory/products/products-workspace.tsx';
const FORM = 'src/app/admin/inventory/products/product-form.tsx';
const INVENTORY_PAGE = 'src/app/admin/inventory/products/page.tsx';
const PRODUCTION_PAGE = 'src/app/admin/production/product-definitions/page.tsx';
const NAV = 'src/components/admin/shell/navigation-data.ts';
const CATALOGUE = 'src/lib/permissions/permission-catalogue.ts';

describe('Product permission reconciliation (frontend)', () => {
  const workspace = read(WORKSPACE);
  const form = read(FORM);
  const inventoryPage = read(INVENTORY_PAGE);
  const productionPage = read(PRODUCTION_PAGE);
  const nav = read(NAV);
  const catalogue = read(CATALOGUE);

  describe('Product surface is gated by the canonical products:* keys', () => {
    it('W01 the Products page renders the canonical ProductsWorkspace (read surface exists)', () => {
      expect(inventoryPage).toContain('<ProductsWorkspace');
    });

    it('W03/W05 the create action requires products:create', () => {
      expect(workspace).toMatch(/id:\s*'new'[\s\S]*?permission:\s*'products:create'/);
      expect(count(workspace, /permission:\s*'products:create'/g)).toBeGreaterThanOrEqual(1);
    });

    it('W04/W06 the edit/activate/deactivate actions require products:update', () => {
      expect(count(workspace, /permission:\s*'products:update'/g)).toBeGreaterThanOrEqual(3);
    });

    it('W02 the Products navigation entry and route are gated by products:read', () => {
      expect(nav).toMatch(/inv-products[\s\S]*?permission:\s*'products:read'/);
      expect(nav).toMatch(/inv-product-categories[\s\S]*?permission:\s*'products:read'/);
    });

    it('W07 the products:* module is localized in the permission catalogue (EN/AR)', () => {
      expect(catalogue).toContain("product: { domain: 'inventory'");
      expect(catalogue).toContain("'product-category'");
    });
  });

  describe('Production configuration authority is separate from product identity authority', () => {
    it('W07b the production section is gated by production-product:* (create for new, update for edit)', () => {
      expect(form).toContain("const productionPermissionKey = isEdit ? 'production-product:update' : 'production-product:create'");
      expect(form).toContain('canManageProduction');
    });

    it('W08 the production controls are read-only when the production authority is missing', () => {
      expect(form).toContain('const productionReadOnly = saving || !canManageProduction');
      expect(form).toContain('disabled={productionReadOnly}');
      expect(form).toContain("t('production.settingsReadOnly')");
    });

    it('W10 the production payload is sent ONLY when the production authority is held', () => {
      expect(form).toMatch(/if \(canManageProduction && productionTouched\) \{[\s\S]*?payload\.production/);
    });
  });

  describe('Archived context is read-only', () => {
    it('W15 archived context disables production management', () => {
      expect(form).toContain('isArchivedContext');
      expect(form).toMatch(/canManageProduction\s*=\s*[\s\S]*?!isArchivedContext/);
    });
  });

  describe('Navigation contract', () => {
    it('W11/W12 production Products & Setup reuses the SAME canonical page/workspace', () => {
      expect(productionPage).toContain('<ProductsWorkspace');
      expect(productionPage).toContain("defaultSection=\"production\"");
    });

    it('W23 the Production sidebar exposes exactly 8 workspaces', () => {
      const productionBlock = nav.slice(nav.indexOf("id: 'production'"));
      const itemsBlock = productionBlock.slice(productionBlock.indexOf('items: ['), productionBlock.indexOf('// 8. Barcode'));
      const ids = [...itemsBlock.matchAll(/id:\s*'(prd-ws-[a-z-]+)'/g)].map((m) => m[1]);
      expect(ids).toEqual([
        'prd-ws-products', 'prd-ws-shifts', 'prd-ws-planning', 'prd-ws-materials',
        'prd-ws-downtime', 'prd-ws-quality', 'prd-ws-cost', 'prd-ws-analytics',
      ]);
      expect(ids.length).toBe(8);
    });

    it('W13 the production products workspace entry is permission-aware', () => {
      expect(nav).toMatch(/prd-ws-products[\s\S]*?permissions:\s*\[[\s\S]*?'products:read'/);
      expect(nav).toMatch(/prd-ws-products[\s\S]*?permissions:\s*\[[\s\S]*?'production-product:read'/);
    });
  });

  describe('No prohibited authorization patterns', () => {
    it('W22 no role-name authorization in the product form or workspace', () => {
      const combined = `${workspace}\n${form}`;
      expect(combined).not.toMatch(/role\s*===/);
      expect(combined).not.toMatch(/role\.name\s*===/);
      expect(combined).not.toMatch(/user\.role\s*===/);
      expect(combined).not.toMatch(/\.name\s*===?\s*['"](ADMIN|SUPER_ADMIN|PRODUCT_ADMIN|PRODUCT_MANAGER)['"]/);
    });

    it('W20 the workspace does not render raw permission keys to the user', () => {
      // labelKey / t(...) drive all visible labels; permission strings only appear in
      // action definitions (never as rendered text).
      expect(workspace).not.toMatch(/>\s*products:(read|create|update|delete)\s*</);
      expect(form).not.toMatch(/>\s*production-product:(read|create|update|delete)\s*</);
    });

    it('W24 an unauthorized product route is handled by deny-by-default guards, not by a SUPER_ADMIN bypass check', () => {
      // The canonical bypass lives in the guard; the components only read `isSuperAdmin`
      // from the resolved auth context and never re-implement role checks.
      expect(workspace).not.toContain('SUPER_ADMIN');
      expect(form).not.toContain('SUPER_ADMIN');
    });
  });

  describe('Localization and direction', () => {
    it('W16/W17 production settings keys exist in English', () => {
      const en = read('src/lib/i18n/locales/en/production.ts');
      expect(en).toContain('settingsReadOnly');
      expect(en).toContain('productionNotes');
      expect(en).toContain('defaultLine');
    });

    it('W16/W17 production settings keys exist in Arabic', () => {
      const ar = read('src/lib/i18n/locales/ar/production.ts');
      expect(ar).toContain('settingsReadOnly');
      expect(ar).toContain('productionNotes');
      expect(ar).toContain('defaultLine');
    });

    it('W18/W19 translated labels carry no hard-coded user-facing English in the form', () => {
      expect(form).not.toMatch(/>\s*(Save|Cancel|Production|Create|Edit)\s*</);
    });
  });
});
