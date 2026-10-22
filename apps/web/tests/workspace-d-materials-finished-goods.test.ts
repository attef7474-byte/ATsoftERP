import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const apiRoot = path.resolve(__dirname, '../../api');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');
const readApi = (rel: string) => fs.readFileSync(path.resolve(apiRoot, rel), 'utf8');

const WORKSPACE_PAGE = 'src/app/admin/production/material-documents/page.tsx';
const MR_REDIRECT = 'src/app/admin/production/material-requirements/page.tsx';
const FG_REDIRECT = 'src/app/admin/production/finished-goods-receipts/page.tsx';
const MR_PANEL = 'src/components/factory/unified-production/material-requirements-panel.tsx';
const MD_PANEL = 'src/components/factory/unified-production/material-documents-panel.tsx';
const FG_PANEL = 'src/components/factory/unified-production/finished-goods-receipts-panel.tsx';
const MR_EDITOR = 'src/app/admin/production/material-requirements/_components/lines-editor.tsx';
const MD_EDITOR = 'src/app/admin/production/material-documents/_components/lines-editor.tsx';
const FG_EDITOR = 'src/app/admin/production/finished-goods-receipts/_components/lines-editor.tsx';
const EN_PROD = 'src/lib/i18n/locales/en/production.ts';
const AR_PROD = 'src/lib/i18n/locales/ar/production.ts';

const MR_SERVICE = 'src/modules/factory/production-material-requirements/production-material-requirements.service.ts';
const MR_DTO = 'src/modules/factory/production-material-requirements/dto/production-material-requirement.dto.ts';
const FG_SERVICE = 'src/modules/factory/production-finished-goods-receipts/production-finished-goods-receipts.service.ts';
const FG_DTO = 'src/modules/factory/production-finished-goods-receipts/dto/production-finished-goods-receipt.dto.ts';
const CONVERSION = 'src/modules/factory/products/product-uom-conversion.service.ts';

/**
 * Workspace D — Materials & Finished Goods consolidation.
 *
 * Three related document surfaces (Material Requirements, Material Documents,
 * Finished Goods Receipts) collapse into one canonical workspace with tabs, with
 * legacy routes redirecting (never 404). Multi-row editors support independent
 * per-material rows and a Product-scoped packaging UOM selection. All
 * transaction-to-base conversion stays in the single conversion authority.
 */
describe('Workspace D — Materials & Finished Goods consolidation', () => {
  describe('W1. Unified workspace and tabs', () => {
    it('renders one canonical workspace with the three tabs', () => {
      const page = read(WORKSPACE_PAGE);
      expect(page).toContain("import { MaterialRequirementsPanel }");
      expect(page).toContain("import { MaterialDocumentsPanel }");
      expect(page).toContain("import { FinishedGoodsReceiptsPanel }");
      expect(page).toContain("{ id: 'requirements', label: t('production.materialRequirements.title') }");
      expect(page).toContain("{ id: 'documents', label: t('production.materialDocuments.title') }");
      expect(page).toContain("{ id: 'finished-goods', label: t('production.finishedGoodsReceipts.title') }");
      expect(page).toContain("'requirements' | 'documents' | 'finished-goods'");
    });

    it('labels the tabs with translatable keys, never with a namespace object', () => {
      const page = read(WORKSPACE_PAGE);
      // `production.materialRequirements` is a namespace object, not a string:
      // using it as a label resolved to the generic "text could not be displayed"
      // fallback. The tab labels must point at the translated titles.
      expect(page).not.toContain("t('production.materialRequirements')");
      expect(page).not.toContain("t('production.materialDocuments')");
      expect(page).not.toContain("t('production.finishedGoodsReceipts')");
      expect(read(EN_PROD)).toContain('materialRequirements: {');
      expect(read(AR_PROD)).toContain('materialRequirements: {');
    });
  });

  describe('W2. Legacy routes redirect (never 404)', () => {
    it('material-requirements redirects to the requirements tab', () => {
      const redirect = read(MR_REDIRECT);
      expect(redirect).toContain("router.replace('/admin/production/material-documents?tab=requirements')");
      expect(redirect).not.toContain('AdminDataGrid');
    });
    it('finished-goods-receipts redirects to the finished-goods tab', () => {
      const redirect = read(FG_REDIRECT);
      expect(redirect).toContain("router.replace('/admin/production/material-documents?tab=finished-goods')");
      expect(redirect).not.toContain('AdminDataGrid');
    });
  });

  describe('W3. One canonical panel per surface (no duplicate implementations)', () => {
    it('the panels export the canonical implementations', () => {
      expect(read(MR_PANEL)).toContain('export function MaterialRequirementsPanel');
      expect(read(MD_PANEL)).toContain('export function MaterialDocumentsPanel');
      expect(read(FG_PANEL)).toContain('export function FinishedGoodsReceiptsPanel');
    });
  });

  describe('W4. Multi-select adds one independent row per material', () => {
    it('the MR editor supports multi-select add with ProductUom per row', () => {
      const editor = read(MR_EDITOR);
      expect(editor).toContain('F9MultiLookup');
      expect(editor).toContain('productUomId');
      expect(editor).toContain('ProductUomSelect');
      expect(editor).toContain('addMultiple');
    });
    it('the MD editor supports multi-select add with ProductUom per row', () => {
      const editor = read(MD_EDITOR);
      expect(editor).toContain('F9MultiLookup');
      expect(editor).toContain('productUomId');
      expect(editor).toContain('ProductUomSelect');
      expect(editor).toContain('addMultiple');
    });
    it('the FG editor supports multi-select add with ProductUom per row', () => {
      const editor = read(FG_EDITOR);
      expect(editor).toContain('F9MultiLookup');
      expect(editor).toContain('productUomId');
      expect(editor).toContain('ProductUomSelect');
      expect(editor).toContain('addMultiple');
    });
    it('multi-select never copies quantity/unit into the new rows', () => {
      for (const editor of [read(MR_EDITOR), read(MD_EDITOR), read(FG_EDITOR)]) {
        expect(editor).toContain('createEmpty');
        expect(editor).not.toMatch(/quantity:\s*lines\[0\]/);
      }
    });
    it('changing the product clears the previously selected packaging unit', () => {
      for (const editor of [read(MR_EDITOR), read(MD_EDITOR), read(FG_EDITOR)]) {
        expect(editor).toContain("productUomId: '',");
      }
    });
  });

  describe('W5. Panels send the canonical selection (productUomId) in their payloads', () => {
    it('MR panel maps productUomId into the prepare/update payload', () => {
      expect(read(MR_PANEL)).toContain('productUomId: line.productUomId || undefined');
    });
    it('MD panel maps productUomId into the payload', () => {
      expect(read(MD_PANEL)).toContain('productUomId: line.productUomId || undefined');
    });
    it('FG panel maps productUomId into the payload', () => {
      expect(read(FG_PANEL)).toContain('productUomId: line.productUomId || undefined');
    });
  });

  describe('W6. Backend — Material Requirements resolve/validate/derive the issue unit', () => {
    it('the line DTO accepts an optional productUomId', () => {
      const dto = readApi(MR_DTO);
      expect(dto).toContain('productUomId?: string;');
    });
    it('the service validates and derives the persisted issueUnit from the canonical ProductUom', () => {
      const service = readApi(MR_SERVICE);
      expect(service).toContain('productUom.findUnique');
      expect(service).toContain('productionMaterialRequirement.productUomNotFound');
      expect(service).toContain('productionMaterialRequirement.productUomMismatch');
      expect(service).toContain('productionMaterialRequirement.productUomInactive');
      expect(service).toContain('derivedIssueUnit.get(line.productId) ?? line.issueUnit');
    });
    it('does not invent a stricter conversionFactor rule (kept as the planning ratio)', () => {
      const service = readApi(MR_SERVICE);
      expect(service).toContain('conversionFactor');
      // conversionFactor is still persisted from the client planning input
      expect(service).toMatch(/conversionFactor:\s*new Prisma\.Decimal/);
    });
  });

  describe('W7. Backend — Finished Goods routes the packaging selection through the single authority', () => {
    it('the FG line DTO accepts productUomId and enteredUnitId', () => {
      const dto = readApi(FG_DTO);
      expect(dto).toContain('productUomId?: string;');
      expect(dto).toContain('enteredUnitId?: string;');
    });
    it('the FG service delegates conversion to movementsService.resolveMovementLines', () => {
      const service = readApi(FG_SERVICE);
      expect(service).toContain('resolveMovementLines');
      expect(service).toContain('productUomId: line.productUomId ?? null');
    });
    it('the conversion authority is the only place that multiplies by the factor', () => {
      const conversion = readApi(CONVERSION);
      expect(conversion).toContain('productUom.findUnique');
      expect(conversion).toContain('row.productId !== productId');
      expect(conversion).toContain('!row.isActive');
    });
  });

  describe('W8. No local (double) conversion in the production document services', () => {
    it('the FG service never multiplies a factor locally', () => {
      const service = readApi(FG_SERVICE);
      expect(service).not.toMatch(/conversionToBase\s*\*/);
      expect(service).not.toMatch(/\*\s*conversionToBase/);
    });
    it('the MR service never performs base-quantity multiplication outside the planning helper', () => {
      const service = readApi(MR_SERVICE);
      expect(service).not.toMatch(/conversionToBase/);
    });
  });

  describe('W9. Arabic and English keys exist and stay synchronized', () => {
    it('both locales define the multi-select keys for all three surfaces', () => {
      const en = read(EN_PROD);
      const ar = read(AR_PROD);
      const keys = [
        'addMultiple:',
        'addMultipleHint:',
        'productUomNotFound:',
        'productUomMismatch:',
        'productUomInactive:',
      ];
      for (const k of keys) {
        expect(en).toContain(k);
        expect(ar).toContain(k);
      }
      expect(en).toContain('selectMaterials:');
      expect(ar).toContain('selectMaterials:');
      expect(en).toContain('selectProducts:');
      expect(ar).toContain('selectProducts:');
    });
  });

  describe('W10. Permission-aware creation stays intact', () => {
    it('the panels keep permission gating for their write actions', () => {
      expect(read(MR_PANEL)).toMatch(/production-material-requirement:/);
      expect(read(MR_PANEL)).toContain("can('prepare')");
      expect(read(MD_PANEL)).toMatch(/can\('create'\)/);
      expect(read(FG_PANEL)).toMatch(/can\('create'\)/);
    });
  });
});
