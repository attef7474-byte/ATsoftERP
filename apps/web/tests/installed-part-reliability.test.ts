import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const apiRoot = path.resolve(__dirname, '../../api');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');
const readApi = (rel: string) => fs.readFileSync(path.resolve(apiRoot, rel), 'utf8');

const PAGE = 'src/app/admin/maintenance/reliability/installed-parts/page.tsx';
const NAV = 'src/components/admin/shell/navigation-data.ts';
const PERMISSION_KEYS = 'src/lib/permission-keys.ts';
const EN_MAINT = 'src/lib/i18n/locales/en/maintenance.ts';
const AR_MAINT = 'src/lib/i18n/locales/ar/maintenance.ts';

const MODULE = 'src/modules/factory/maintenance/maintenance-reliability';
const CALC = `${MODULE}/reliability-calculations.ts`;
const SERVICE = `${MODULE}/installed-part-reliability.service.ts`;
const CONTROLLER = `${MODULE}/maintenance-reliability.controller.ts`;
const CONTRACT = `${MODULE}/dto/installed-part-reliability.dto.ts`;

describe('Installed part reliability analytics (read-only)', () => {
  describe('W1/W2. Reliability page renders with the shared UI and human identity', () => {
    it('renders the page with header, data table and pagination', () => {
      const page = read(PAGE);
      expect(page).toContain("t('maintenance.installedPartReliability')");
      expect(page).toContain('<DataTable');
      expect(page).toContain('<Pagination');
      expect(page).toContain('<PageHeader');
    });
    it('columns use human-readable machine/spare-part identity, not raw ids', () => {
      const page = read(PAGE);
      expect(page).toContain('r.machine.code');
      expect(page).toContain('r.sparePart.code');
      expect(page).toContain('r.machineComponent');
    });
  });

  describe('W3. Filters drive the query through canonical lookups', () => {
    it('machine, spare part and production line use the shared F9 adapters', () => {
      const page = read(PAGE);
      expect(page).toContain('machineAdapter');
      expect(page).toContain('sparePartAdapter');
      expect(page).toContain('productionLineAdapter');
    });
    it('query params include pagination and the reliability filters', () => {
      const page = read(PAGE);
      expect(page).toContain('p.machineId');
      expect(page).toContain('p.sparePartId');
      expect(page).toContain('p.onlyEarlyFailure');
      expect(page).toContain('p.onlyApproachingEol');
    });
  });

  describe('W4. Dashboard never fabricates a metric when data is missing', () => {
    it('near-end and overdue cards fall back to the insufficient marker', () => {
      const page = read(PAGE);
      expect(page).toContain('summary.hasExpectedLifeData');
      expect(page).toContain("t('maintenance.iprInsufficient')");
    });
  });

  describe('W5. Data-quality panel is present and honest', () => {
    it('renders the data-quality card with the honesty note', () => {
      const page = read(PAGE);
      expect(page).toContain("t('maintenance.iprDataQuality')");
      expect(page).toContain("t('maintenance.iprDqNote')");
      expect(page).toContain('dq.withoutExpectedLife');
      expect(page).toContain('dq.removedMissingRemovedAt');
    });
  });

  describe('W6. Reliability details open a timeline from the real API', () => {
    it('row click loads the machine+part detail endpoint', () => {
      const page = read(PAGE);
      expect(page).toContain('openDetail');
      expect(page).toContain('/maintenance/reliability/installed-parts/${row.machine.id}/${row.sparePart.id}');
      expect(page).toContain('<Modal');
      expect(page).toContain("t('maintenance.iprTimeline')");
    });
  });

  describe('W7. The page consumes the real read-only endpoints', () => {
    it('calls list, summary and data-quality endpoints', () => {
      const page = read(PAGE);
      expect(page).toContain("'/maintenance/reliability/installed-parts'");
      expect(page).toContain("'/maintenance/reliability/installed-parts/summary'");
      expect(page).toContain("'/maintenance/reliability/installed-parts/data-quality'");
    });
  });

  describe('W8. Arabic and English translation keys exist', () => {
    it('both locales define the reliability keys', () => {
      const keys = [
        'installedPartReliability',
        'iprSubtitle',
        'iprColMachine',
        'iprColMtbf',
        'iprColMttr',
        'iprBandEXPIRED',
        'iprStatusFAILED',
        'iprDataQuality',
        'iprDqNote',
        'iprInsufficient',
      ];
      const en = read(EN_MAINT);
      const ar = read(AR_MAINT);
      for (const k of keys) {
        expect(en).toContain(`${k}:`);
        expect(ar).toContain(`${k}:`);
      }
    });
  });

  describe('W9/W10. Navigation and permission registry', () => {
    it('adds a navigation entry gated by the maintenance reliability permission', () => {
      const nav = read(NAV);
      expect(nav).toContain("labelKey: 'navigation.installedPartReliability'");
      expect(nav).toContain("route: '/admin/maintenance/reliability/installed-parts'");
      expect(nav).toContain("permission: 'maintenance-reliability:read'");
    });
    it('exposes the reliability permission key in the web registry', () => {
      expect(read(PERMISSION_KEYS)).toContain('MAINTENANCE_RELIABILITY_READ');
    });
    it('reuses the existing seeded permission instead of inventing a new one', () => {
      const seed = readApi('prisma/seed/seed-cmms-permission-keys.ts');
      expect(seed).toContain('maintenance-reliability:read');
    });
  });

  describe('W11/W12. Backend routes mirror the web calls and are ordered safely', () => {
    it('declares the part reliability routes with the shared permission', () => {
      const controller = readApi(CONTROLLER);
      expect(controller).toContain("@Get('installed-parts')");
      expect(controller).toContain("@Get('installed-parts/summary')");
      expect(controller).toContain("@Get('installed-parts/data-quality')");
      expect(controller).toContain("@Get('installed-parts/:machineId/:sparePartId')");
      expect(controller).toContain("@Permissions('maintenance-reliability:read')");
    });
    it('declares the static summary/data-quality routes before the parameterised detail route', () => {
      const controller = readApi(CONTROLLER);
      const summary = controller.indexOf("@Get('installed-parts/summary')");
      const quality = controller.indexOf("@Get('installed-parts/data-quality')");
      const detail = controller.indexOf("@Get('installed-parts/:machineId/:sparePartId')");
      expect(summary).toBeGreaterThan(-1);
      expect(quality).toBeGreaterThan(-1);
      expect(detail).toBeGreaterThan(-1);
      expect(summary).toBeLessThan(detail);
      expect(quality).toBeLessThan(detail);
    });
  });

  describe('W13. The analytics layer is strictly read-only', () => {
    it('the reliability service performs no writes', () => {
      const service = readApi(SERVICE);
      expect(service).not.toMatch(/\.create\(/);
      expect(service).not.toMatch(/\.update\(/);
      expect(service).not.toMatch(/\.delete\(/);
      expect(service).not.toMatch(/\.upsert\(/);
      expect(service).not.toMatch(/transaction/);
    });
    it('every read is scoped through the owning machine', () => {
      const service = readApi(SERVICE);
      expect(service).toContain('machine: this.machineScope(ctx)');
    });
  });

  describe('W14. Query DTO declares the whitelisted filter fields', () => {
    it('declares validated filter fields and enums', () => {
      const dto = readApi(CONTRACT);
      expect(dto).toContain('QueryInstalledPartReliabilityDto');
      expect(dto).toContain('IsOptional');
      expect(dto).toContain('IsIn');
      expect(dto).toContain('RELIABILITY_STATUSES');
      expect(dto).toContain('LIFE_STATUSES');
    });
  });

  describe('W15. Failure classification is evidence-based, not inferred', () => {
    it('treats explicit FAILED status or a classified downtime category as the only failure evidence', () => {
      const calc = readApi(CALC);
      expect(calc).toContain("status === 'FAILED'");
      expect(calc).toContain('linkedFailureCategories');
    });
    it('never infers a failure from a replacement action', () => {
      const calc = readApi(CALC);
      expect(calc).not.toContain('replacementAction');
      expect(calc).not.toContain('REPLACED');
    });
  });

  describe('W16. Service life uses installation timestamps, never inventory age', () => {
    it('derives service life from installedAt/removedAt', () => {
      const calc = readApi(CALC);
      expect(calc).toContain('installedAt');
      expect(calc).toContain('removedAt');
      expect(calc).not.toContain('createdAt');
    });
  });

  describe('W17. MTBF/MTTR minimum-evidence contracts', () => {
    it('MTBF requires at least two failure events', () => {
      const calc = readApi(CALC);
      expect(calc).toContain('valid.length < 2');
    });
    it('MTTR reports insufficient data when no repair interval exists', () => {
      const calc = readApi(CALC);
      expect(calc).toContain("status: 'INSUFFICIENT_DATA'");
      expect(calc).toContain('repairDurationsMs');
    });
    it('keeps labor, downtime and elapsed repair time separate', () => {
      const calc = readApi(CALC);
      expect(calc).toContain('laborMs');
      expect(calc).toContain('downtimeMs');
    });
  });
});
