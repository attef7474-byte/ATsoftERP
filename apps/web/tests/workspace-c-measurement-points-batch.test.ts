import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');

const PANEL = 'src/components/factory/unified-production/measurement-points-panel.tsx';
const EN_PROD = 'src/lib/i18n/locales/en/production.ts';
const AR_PROD = 'src/lib/i18n/locales/ar/production.ts';

/**
 * Workspace C — deferred Measurement Points multi-machine batch CREATE UI.
 *
 * The backend contract (POST /production/measurement-points/batch) was audited:
 *   - machineIds: string[] (required, non-empty, deduped server-side).
 *   - A shared safe field set is applied to every created point.
 *   - machineComponentId and isAuthoritativeFinal are SINGLE-MACHINE ONLY
 *     (a component belongs to exactly one machine; a ProductionLine has at most
 *     one authoritative final-output point). Multi-select batch CREATE must not
 *     send these; they are assigned later via single-record Edit.
 *   - The whole selection is created atomically (all-or-nothing, DRAFT rows).
 *
 * This suite proves the frontend sends the exact contract field names, gates the
 * batch entry point on the create permission, exposes selected/create counts,
 * reports the created count on success, and never leaks component/authoritative
 * fields into a multi-machine request.
 */
describe('Workspace C — Measurement Points batch CREATE UI', () => {
  describe('MPW1. Batch entry point is permission-gated', () => {
    it('renders the Add Multiple button only when the create permission is held', () => {
      const panel = read(PANEL);
      expect(panel).toContain("{can('create') && <Button variant=\"secondary\" onClick={openBatch}>");
    });

    it('derives can() from the stable permission prefix', () => {
      const panel = read(PANEL);
      expect(panel).toContain('production-measurement-point:${action}');
      expect(panel).toContain("can = useCallback((action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes(");
      expect(panel).toContain("import { useAuth } from '../../../lib/auth-context';");
    });
  });

  describe('MPW2. Batch modal and multi-select machines', () => {
    it('opens a dedicated batch modal from openBatch', () => {
      const panel = read(PANEL);
      expect(panel).toContain('const openBatch = () => {');
      expect(panel).toContain('setBatchOpen(true);');
      expect(panel).toContain("title={t('production.measurementPoints.addMultiple')}");
    });

    it('uses F9MultiLookup on machines, filtered by the selected line', () => {
      const panel = read(PANEL);
      expect(panel).toContain('<F9MultiLookup');
      expect(panel).toContain("label={t('production.measurementPoints.selectMachines')}");
      expect(panel).toContain('value={batchForm.machineIds}');
      expect(panel).toContain('adapter={machineAdapter}');
      expect(panel).toContain('filters={batchForm.productionLineId ? { productionLineId: batchForm.productionLineId } : undefined}');
    });

    it('reports selected machines and the create count before saving', () => {
      const panel = read(PANEL);
      expect(panel).toContain("t('production.measurementPoints.batchSelectedCount', undefined, { count: batchForm.machineIds.length })");
      expect(panel).toContain("t('production.measurementPoints.batchConfirmCount', undefined, { count: batchForm.machineIds.length })");
    });
  });

  describe('MPW3. Required-field validation before POST', () => {
    it('requires line, unit, at least one machine, name and effectiveFrom', () => {
      const panel = read(PANEL);
      expect(panel).toContain("if (!batchForm.productionLineId) errors.productionLineId = t('validation.required');");
      expect(panel).toContain("if (!batchForm.productionUnitId) errors.productionUnitId = t('validation.required');");
      expect(panel).toContain("if (batchForm.machineIds.length === 0) errors.machineIds = t('production.measurementPoints.machinesRequired');");
      expect(panel).toContain("if (!batchForm.name) errors.name = t('validation.required');");
      expect(panel).toContain("if (!batchForm.effectiveFrom) errors.effectiveFrom = t('validation.required');");
      expect(panel).toContain("if (batchForm.source === 'COUNTER' && !batchForm.counterModulus) errors.counterModulus = t('validation.required');");
    });

    it('aborts the POST when any required field is missing', () => {
      const panel = read(PANEL);
      expect(panel).toContain('if (Object.keys(errors).length > 0) return;');
    });
  });

  describe('MPW4. Exact batch contract field names in one POST', () => {
    it('posts to the batch route with the audited DTO field names', () => {
      const panel = read(PANEL);
      expect(panel).toContain("await api.post('/production/measurement-points/batch', {");
      expect(panel).toContain('machineIds: batchForm.machineIds,');
      expect(panel).toContain('productionLineId: batchForm.productionLineId,');
      expect(panel).toContain('productionUnitId: batchForm.productionUnitId,');
      expect(panel).toContain('name: batchForm.name,');
      expect(panel).toContain('role: batchForm.role,');
      expect(panel).toContain('source: batchForm.source,');
      expect(panel).toContain('unit: batchForm.unit,');
      expect(panel).toContain('effectiveFrom: batchForm.effectiveFrom,');
    });

    it('is a single POST for the whole selection (one request, all-or-nothing)', () => {
      const panel = read(PANEL);
      const batchPosts = panel.match(/api\.post\('\/production\/measurement-points\/batch'/g) || [];
      expect(batchPosts.length).toBe(1);
    });
  });

  describe('MPW5. Component safety — component/authoritative are single-machine only', () => {
    it('never sends machineComponentId in the batch payload', () => {
      const panel = read(PANEL);
      const payloadStart = panel.indexOf("api.post('/production/measurement-points/batch'");
      const payloadEnd = panel.indexOf('});', payloadStart);
      const payload = panel.slice(payloadStart, payloadEnd);
      expect(payload).not.toContain('machineComponentId');
    });

    it('forces isAuthoritativeFinal false for multi-select and allows it only for exactly one machine', () => {
      const panel = read(PANEL);
      expect(panel).toContain('isAuthoritativeFinal: batchForm.machineIds.length === 1 ? batchForm.isAuthoritativeFinal : false,');
      expect(panel).toContain('{batchForm.machineIds.length === 1 && (');
    });
  });

  describe('MPW6. Success count and grid refresh', () => {
    it('reports the created count on success and refreshes the grid', () => {
      const panel = read(PANEL);
      expect(panel).toContain("showToast(t('production.measurementPoints.batchCreated', undefined, { count: batchForm.machineIds.length }), 'success');");
      expect(panel).toContain('setBatchOpen(false);');
      expect(panel).toContain('fetchData(meta.page);');
    });

    it('surfaces API failures through the shared error handler (atomic rollback leaves no partial rows)', () => {
      const panel = read(PANEL);
      expect(panel).toContain('} catch (err: any) { handleApiError(err); }');
    });
  });

  describe('MPW7. Edit stays single-record (no batch edit endpoint)', () => {
    it('single-record create and edit use the singular route, never the batch route', () => {
      const panel = read(PANEL);
      expect(panel).toContain("await api.post('/production/measurement-points', payload);");
      expect(panel).toContain('await api.patch(`/production/measurement-points/${editItem.id}`, payload);');
      const batchEdit = panel.match(/api\.patch\('\/production\/measurement-points\/batch'/g) || [];
      expect(batchEdit.length).toBe(0);
    });
  });

  describe('MPW8. No raw IDs, malformed F9 queries, or fallback text', () => {
    it('the panel never hard-codes cuids or builds malformed F9 index queries', () => {
      const panel = read(PANEL);
      expect(panel).not.toMatch(/c[a-z0-9]{20,}/);
      expect(panel).not.toMatch(/\?0=/);
      expect(panel).not.toMatch(/\?1=/);
    });

    it('the panel never renders a raw translation key or hard-coded fallback text', () => {
      expect(read(PANEL)).not.toMatch(/t\(\s*'[^']+'\s*,\s*'/);
    });
  });

  describe('MPW9. Arabic and English keys exist and are synchronized', () => {
    it('every new batch count/success key exists in both locales', () => {
      const en = read(EN_PROD);
      const ar = read(AR_PROD);
      const keys = [
        'batchSelectedCount:',
        'batchConfirmCount:',
        'batchCreated:',
      ];
      for (const key of keys) {
        expect(en).toContain(key);
        expect(ar).toContain(key);
      }
    });

    it('the pre-existing batch label and safety keys exist in both locales', () => {
      const en = read(EN_PROD);
      const ar = read(AR_PROD);
      const keys = [
        'addMultiple:',
        'addMultipleHint:',
        'selectMachines:',
        'batchNameHint:',
        'machinesRequired:',
        'batchComponentPerMachine:',
        'batchAuthoritativeSingleTarget:',
      ];
      for (const key of keys) {
        expect(en).toContain(key);
        expect(ar).toContain(key);
      }
    });

    it('the count keys interpolate the machine count', () => {
      const en = read(EN_PROD);
      const ar = read(AR_PROD);
      expect(en).toMatch(/batchSelectedCount: 'Selected machines: \{count\}',/);
      expect(en).toMatch(/batchConfirmCount: 'This will create \{count\} draft measurement point\(s\)\.',/);
      expect(en).toMatch(/batchCreated: '\{count\} measurement point\(s\) created as drafts',/);
      expect(ar).toMatch(/batchSelectedCount: '[^']*\{count\}',/);
      expect(ar).toMatch(/batchConfirmCount: '[^']*\{count\}[^']*',/);
      expect(ar).toMatch(/batchCreated: '[^']*\{count\}[^']*',/);
    });
  });
});
