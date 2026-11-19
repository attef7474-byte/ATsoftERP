import fs from 'node:fs';
import path from 'node:path';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { resolveTranslation, TRANSLATION_FALLBACKS } from '../src/lib/i18n/translation-core';
import { ITEM_TYPE_LABEL_KEYS, PRODUCT_ITEM_TYPES, isProductItemType } from '../src/lib/product-item-type';

/**
 * UNIFIED ITEM MASTER — PHASE 1 web contract tests.
 *
 * Source-contract assertions (the web jest harness does not compile JSX) for the
 * single canonical item catalog, its authoritative itemType classification and
 * the Arabic/English presentation required by the approved plan. These tests do
 * NOT cover Phase 2 receiving / issue-voucher / spare-part-life changes.
 */
const webSrc = path.resolve(__dirname, '../src');
const read = (rel: string) => fs.readFileSync(path.join(webSrc, rel), 'utf8');
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

const WORKSPACE = 'components/inventory/products/products-workspace.tsx';
const FORM = 'app/admin/inventory/products/product-form.tsx';
const PRODUCTION_PAGE = 'app/admin/production/product-definitions/page.tsx';
const SPARE_PARTS_PAGE = 'app/admin/maintenance/spare-parts/page.tsx';
const ADMIN_TYPES = 'lib/admin-types/inventory.ts';
const NAVIGATION = 'components/admin/shell/navigation-data.ts';
const ITEM_TYPE_MODULE = 'lib/product-item-type.ts';

const workspace = read(WORKSPACE);
const form = read(FORM);
const productionPage = read(PRODUCTION_PAGE);
const sparePartsPage = read(SPARE_PARTS_PAGE);
const adminTypes = read(ADMIN_TYPES);
const navigation = read(NAVIGATION);
const itemTypeModule = read(ITEM_TYPE_MODULE);

describe('unified item master — canonical vocabulary and type', () => {
  it('exposes exactly the six approved business item types', () => {
    expect(PRODUCT_ITEM_TYPES).toEqual([
      'RAW_MATERIAL',
      'FINISHED_GOOD',
      'SPARE_PART',
      'PACKAGING_MATERIAL',
      'CONSUMABLE',
      'GENERAL',
    ]);
    for (const type of PRODUCT_ITEM_TYPES) expect(isProductItemType(type)).toBe(true);
    expect(isProductItemType('FINISHED_PRODUCT')).toBe(false);
    expect(isProductItemType(null)).toBe(false);
  });

  it('has one Product type carrying the authoritative classification and read-only spare-part link', () => {
    expect(adminTypes).toContain('export interface Product {');
    expect(count(adminTypes, 'export interface Product {')).toBe(1);
    expect(adminTypes).toMatch(/itemType\?: ProductItemType \| null;/);
    expect(adminTypes).toContain('spareParts?: Array<');
  });
});

describe('unified item master — single catalog workspace', () => {
  it('titles the canonical page Items and keeps one management destination', () => {
    expect(workspace).toContain("t('inventory.itemsTitle')");
    expect(navigation).toContain("{ id: 'inv-products', labelKey: 'navigation.products', route: '/admin/inventory/products', permission: 'products:read' }");
    expect(count(workspace, 'export function ProductsWorkspace(')).toBe(1);
  });

  it('sends the item-type filter to the server instead of filtering in the browser', () => {
    expect(workspace).toContain('if (itemTypeFilter) params.itemType = itemTypeFilter;');
    expect(workspace).toContain("api.get<{ data: Product[]; meta: any }>('/products', { params })");
    expect(workspace).toContain('useEffect(() => { fetchData(); }, [itemTypeFilter]);');
    expect(workspace).toContain('PRODUCT_ITEM_TYPES.map((type) =>');
  });

  it('shows the classification column and renders unclassified legacy rows explicitly', () => {
    expect(workspace).toContain("key: 'itemType'");
    expect(workspace).toContain("header: t('inventory.itemType')");
    expect(workspace).toContain('itemTypeLabel(p.itemType, t)');
    // The explicit "unclassified" label is resolved by the shared vocabulary module.
    expect(itemTypeModule).toContain("t('inventory.unclassified')");
  });
});

describe('unified item master — one dynamic Product form', () => {
  it('renders exactly one create/edit form with item type as the first field', () => {
    expect(count(form, 'export function ProductForm(')).toBe(1);
    const basicInfoIndex = form.indexOf("t('complexForms.basicInformation')");
    const itemTypeIndex = form.indexOf("label={t('inventory.itemType')}");
    const codeIndex = form.indexOf("label={t('inventory.code')}");
    expect(basicInfoIndex).toBeGreaterThan(-1);
    expect(itemTypeIndex).toBeGreaterThan(basicInfoIndex);
    expect(itemTypeIndex).toBeLessThan(codeIndex);
    expect(form).toContain('PRODUCT_ITEM_TYPES.map((type)');
    expect(form).toContain('ITEM_TYPE_LABEL_KEYS[type]');
  });

  it('requires a valid item type for creation and sends it on both create and edit', () => {
    expect(form).toContain("if (!isEdit && !form.itemType) errs.itemType = t('inventory.itemTypeRequired');");
    expect(form).toContain('itemType: form.itemType || undefined,');
    expect(form).toContain("await api.post('/products', payload);");
    expect(form).toContain('await api.patch(`/products/${productId}`, payload);');
  });

  it('keeps legacy unclassified rows editable without inventing a classification', () => {
    expect(form).toContain("itemType: item.itemType ?? ''");
    expect(form).toContain("{ value: '', label: isEdit ? t('inventory.unclassified') : '' }");
    // Blank on edit is omitted from the payload, so NULL is preserved.
    expect(form).toContain('// Omitted on edit when blank so legacy unclassified rows keep their NULL.');
  });

  it('shows type-specific guidance without duplicating technical or stock data', () => {
    expect(form).toContain("form.itemType === 'FINISHED_GOOD'");
    expect(form).toContain("form.itemType === 'RAW_MATERIAL' || form.itemType === 'PACKAGING_MATERIAL'");
    expect(form).toContain("t('inventory.finishedGoodHint')");
    expect(form).toContain("t('inventory.rawMaterialHint')");
    expect(form).not.toContain('minRecommendedStock');
    expect(form).not.toContain('partNumber');
  });

  it('gates the spare-part technical section on spare-part read permission', () => {
    expect(form).toContain("form.itemType === 'SPARE_PART'");
    expect(form).toContain("permissions?.permissions.includes('spare-part:read')");
    expect(form).toContain("t('inventory.sparePartPermissionHint')");
    expect(form).toContain("t('inventory.sparePartLinkedRecord')");
    expect(form).toContain("router.push('/admin/maintenance/spare-parts')");
  });
});

describe('unified item master — domain boundaries', () => {
  it('keeps production product setup a configuration view over finished-good items', () => {
    expect(count(productionPage, '<ProductsWorkspace')).toBe(1);
    expect(productionPage).toContain('defaultItemType="FINISHED_GOOD"');
    expect(productionPage).toContain("t('production.productsWorkspace')");
    expect(productionPage).toContain("t('inventory.itemsTitle')");
    expect(productionPage).not.toContain('ProductDefinitionsWorkspace');
  });

  it('filters the spare-part inventory-link picker to SPARE_PART items', () => {
    expect(sparePartsPage).toContain('adapter={productAdapter}');
    expect(sparePartsPage).toContain("filters={{ itemType: 'SPARE_PART' }}");
    expect(sparePartsPage).toContain("t('maintenance.sparePart.form.linkedProductHint')");
  });

  it('filters production material and finished-good pickers on the server', () => {
    const fgr = read('app/admin/production/finished-goods-receipts/_components/lines-editor.tsx');
    const materialReq = read('app/admin/production/material-requirements/_components/lines-editor.tsx');
    const materialDoc = read('app/admin/production/material-documents/_components/lines-editor.tsx');
    expect(fgr).toContain("filters={{ itemType: 'FINISHED_GOOD' }}");
    expect(materialReq).toContain("filters={{ itemTypes: 'RAW_MATERIAL,PACKAGING_MATERIAL' }}");
    expect(materialDoc).toContain("filters={{ itemTypes: 'RAW_MATERIAL,PACKAGING_MATERIAL' }}");
  });

  it('does not introduce item-type permissions or a second product model', () => {
    for (const source of [workspace, form, productionPage, sparePartsPage]) {
      expect(source).not.toMatch(/item-type:(read|create|update|delete)/);
    }
    expect(form).not.toContain('export interface Product {');
  });
});

describe('unified item master — Arabic RTL and English LTR', () => {
  const ITEM_TYPE_KEYS = PRODUCT_ITEM_TYPES.map((type) => ITEM_TYPE_LABEL_KEYS[type]);
  const KEYS = [
    'inventory.itemsTitle',
    'inventory.itemType',
    'inventory.itemTypeFilters',
    'inventory.unclassified',
    'inventory.itemTypeHint',
    'inventory.itemTypeRequired',
    'inventory.finishedGoodHint',
    'inventory.rawMaterialHint',
    'inventory.sparePartSection',
    'inventory.sparePartDataHint',
    'inventory.sparePartLinkedRecord',
    'inventory.sparePartNotLinked',
    'inventory.manageSpareParts',
    'inventory.sparePartPermissionHint',
    'maintenance.sparePart.form.linkedProductHint',
    'navigation.products',
    'production.productsWorkspace',
    'production.productsWorkspaceDescription',
    ...ITEM_TYPE_KEYS,
  ];

  it('resolves every new key in Arabic (RTL)', () => {
    for (const key of KEYS) {
      const value = resolveTranslation(ar, 'ar', key);
      expect(value).not.toBe(TRANSLATION_FALLBACKS.ar);
      expect(String(value).length).toBeGreaterThan(0);
    }
  });

  it('resolves every new key in English (LTR)', () => {
    for (const key of KEYS) {
      const value = resolveTranslation(en, 'en', key);
      expect(value).not.toBe(TRANSLATION_FALLBACKS.en);
      expect(String(value).length).toBeGreaterThan(0);
    }
  });

  it('uses the exact approved Arabic item-type labels', () => {
    expect(resolveTranslation(ar, 'ar', ITEM_TYPE_LABEL_KEYS.RAW_MATERIAL)).toBe('مادة خام');
    expect(resolveTranslation(ar, 'ar', ITEM_TYPE_LABEL_KEYS.FINISHED_GOOD)).toBe('منتج تام');
    expect(resolveTranslation(ar, 'ar', ITEM_TYPE_LABEL_KEYS.SPARE_PART)).toBe('قطعة غيار');
    expect(resolveTranslation(ar, 'ar', ITEM_TYPE_LABEL_KEYS.PACKAGING_MATERIAL)).toBe('مادة تعبئة وتغليف');
    expect(resolveTranslation(ar, 'ar', ITEM_TYPE_LABEL_KEYS.CONSUMABLE)).toBe('مستهلك');
    expect(resolveTranslation(ar, 'ar', ITEM_TYPE_LABEL_KEYS.GENERAL)).toBe('عام');
    expect(resolveTranslation(ar, 'ar', 'inventory.unclassified')).toBe('غير مصنف');
    expect(resolveTranslation(ar, 'ar', 'inventory.itemsTitle')).toBe('الأصناف');
  });

  it('uses the approved production setup and Items titles', () => {
    expect(resolveTranslation(ar, 'ar', 'production.productsWorkspace')).toBe('إعداد المنتجات للإنتاج');
    expect(resolveTranslation(en, 'en', 'production.productsWorkspace')).toBe('Production Product Setup');
    expect(resolveTranslation(en, 'en', 'inventory.itemsTitle')).toBe('Items');
    expect(resolveTranslation(en, 'en', 'navigation.products')).toBe('Items');
  });
});
