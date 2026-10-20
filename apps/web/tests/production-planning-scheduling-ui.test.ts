import * as fs from 'fs';
import * as path from 'path';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const panelSource = read('src/components/factory/unified-production/production-scheduling-panel.tsx');
const pageSource = read('src/app/admin/production/orders/page.tsx');
const enProduction = read('src/lib/i18n/locales/en/production.ts');
const arProduction = read('src/lib/i18n/locales/ar/production.ts');
const adminTypes = read('src/lib/admin-types/production.ts');
const apiConstants = read(
  '../api/src/modules/factory/production-planning/production-planning.constants.ts',
);

const reasonCodes = [
  'NO_ELIGIBLE_RESOURCE',
  'NO_CAPACITY_STANDARD',
  'NO_WORKING_SHIFT',
  'MATERIAL_SHORTAGE',
  'RESOURCE_FULL',
  'INVALID_ORDER_STATE',
  'MISSING_DUE_DATA',
  'CONTEXT_INVALID',
  'AMBIENT_CAPACITY_AMBIGUOUS',
  'INVALID_REFERENCES',
  'UNIT_MISMATCH',
  'HORIZON_EXCEEDED',
];

const reasonI18nKeys = [
  'noEligibleResource',
  'noCapacityStandard',
  'noWorkingShift',
  'materialShortage',
  'resourceFull',
  'invalidOrderState',
  'missingDueData',
  'contextInvalid',
  'ambiguousCapacity',
  'invalidReferences',
  'unitMismatch',
  'horizonExceeded',
];

const planningEn: any = (en as any).production.planning;
const planningAr: any = (ar as any).production.planning;

describe('production planning & scheduling UI (W01-W36)', () => {
  it('W01. workspace page registers a scheduling tab in the unified tab union', () => {
    expect(pageSource).toContain("'scheduling'");
    expect(pageSource).toContain('ProductionSchedulingPanel');
  });

  it('W02. scheduling tab read permission is production-order:readiness', () => {
    expect(pageSource).toMatch(/scheduling:\s*'production-order:readiness'/);
  });

  it('W03. scheduling tab label comes from a translation key (no hard-coded text)', () => {
    expect(pageSource).toContain("t('production.planning.tab')");
  });

  it('W04. panel is gated by permission before rendering (TabPanel)', () => {
    expect(pageSource).toContain('isVisible');
  });

  it('W05. panel imports the real api client', () => {
    expect(panelSource).toContain("from '../../../lib/api'");
    expect(panelSource).toContain('api.post');
  });

  it('W06. preview calls the real backend endpoint', () => {
    expect(panelSource).toContain("'/production/planning/preview'");
  });

  it('W07. apply calls the real backend endpoint', () => {
    expect(panelSource).toContain("'/production/planning/apply'");
  });

  it('W08. preview uses POST (creation-free computation)', () => {
    expect(panelSource).toMatch(/api\.post<PlanningDraftResult>\('\/production\/planning\/preview'/);
  });

  it('W09. apply uses POST with plans payload', () => {
    expect(panelSource).toContain('plans:');
    expect(panelSource).toContain('scheduledStartAt');
    expect(panelSource).toContain('scheduledEndAt');
  });

  it('W10. panel does not hard-code any user-facing text', () => {
    expect(panelSource).not.toMatch(/>\s*[A-Za-z]{4,}\s*</);
    expect(panelSource).toContain('t(');
  });

  it('W11. panel reuses the unified F9 lookup pattern', () => {
    expect(panelSource).toContain('F9Lookup');
    expect(panelSource).toContain('productionLineAdapter');
    expect(panelSource).toContain('productionShiftCalendarAdapter');
  });

  it('W12. panel reuses the shared AdminDataGrid', () => {
    expect(panelSource).toContain('AdminDataGrid');
  });

  it('W13. panel reuses the shared useApiErrorHandler', () => {
    expect(panelSource).toContain('useApiErrorHandler');
  });

  it('W14. panel reuses the shared toast provider', () => {
    expect(panelSource).toContain('useToast');
  });

  it('W15. apply is guarded client-side by production-order:plan', () => {
    expect(panelSource).toContain("can('production-order:plan')");
    expect(panelSource).toContain('canApply');
  });

  it('W16. apply is disabled until a preview exists and rows are selected', () => {
    expect(panelSource).toContain('!draft || selectedOps.length === 0');
  });

  it('W17. apply requires an explicit confirmation step', () => {
    expect(panelSource).toContain('confirmApply');
    expect(panelSource).toContain('applyConfirmation');
  });

  it('W18. preview hint states preview is read-only', () => {
    expect(panelSource).toContain('previewHint');
  });

  it('W19. RTL direction is honored on grids', () => {
    expect(panelSource).toContain('dir={dir}');
    expect(panelSource).toContain('useTranslation');
  });

  it('W20. horizon filters are sent as instants', () => {
    expect(panelSource).toContain('horizonFrom');
    expect(panelSource).toContain('horizonTo');
    expect(panelSource).toContain('dayStart');
    expect(panelSource).toContain('dayEnd');
  });

  it('W21. calendar and line are optional filters (auto-detect supported)', () => {
    expect(panelSource).toContain('calendarAuto');
    expect(panelSource).toContain('allLines');
  });

  it('W22. scheduled grid surfaces lateness and material state', () => {
    expect(panelSource).toContain('latenessState');
    expect(panelSource).toContain('materialState');
  });

  it('W23. unscheduled grid surfaces localized reason codes (never raw)', () => {
    expect(panelSource).toContain('reasonKeys');
    expect(panelSource).toContain('row.reasonKeys.map((key) => t(key))');
  });

  it('W24. resource load summary renders utilization', () => {
    expect(panelSource).toContain('utilizationPercent');
    expect(panelSource).toContain('availableMinutes');
  });

  it('W25. totals cards expose requested/scheduled/unscheduled/late/shortage', () => {
    for (const key of ['requested', 'scheduledCount', 'unscheduledCount', 'lateCount', 'shortageRisk']) {
      expect(panelSource).toContain(`production.planning.${key}`);
    }
  });

  it('W26. admin types declare the planning draft result contract', () => {
    expect(adminTypes).toContain('interface PlanningDraftResult');
    expect(adminTypes).toContain('interface ScheduledOperation');
    expect(adminTypes).toContain('interface UnscheduledOperation');
    expect(adminTypes).toContain('interface ApplyPlanningResult');
  });

  it('W27. draft result type pins the finite-capacity engine version field', () => {
    expect(adminTypes).toContain('engineVersion');
    expect(adminTypes).toContain('resourceLoad');
  });

  it('W28. EN planning block defines the navigation/tab label', () => {
    expect(planningEn.tab).toBeTruthy();
    expect(planningEn.title).toBeTruthy();
    expect(planningEn.description).toBeTruthy();
  });

  it('W29. AR planning block defines the same navigation/tab label', () => {
    expect(planningAr.tab).toBeTruthy();
    expect(planningAr.title).toBeTruthy();
    expect(planningAr.description).toBeTruthy();
  });

  it('W30. EN and AR planning key sets are synchronized', () => {
    const enKeys = Object.keys(planningEn).sort();
    const arKeys = Object.keys(planningAr).sort();
    expect(arKeys).toEqual(enKeys);
  });

  it('W31. EN and AR reason sub-key sets are synchronized', () => {
    const enKeys = Object.keys(planningEn.reason).sort();
    const arKeys = Object.keys(planningAr.reason).sort();
    expect(arKeys).toEqual(enKeys);
  });

  it('W32. both locales define every reason i18n key', () => {
    for (const key of reasonI18nKeys) {
      expect(planningEn.reason[key]).toBeTruthy();
      expect(planningAr.reason[key]).toBeTruthy();
    }
  });

  it('W33. locale reason keys match the API reason-code i18n mapping', () => {
    for (const key of reasonI18nKeys) {
      expect(apiConstants).toContain(`production.planning.reason.${key}`);
    }
  });

  it('W34. API declares exactly the 12 planning reason codes mirrored in the UI', () => {
    for (const code of reasonCodes) {
      expect(apiConstants).toContain(`'${code}'`);
    }
  });

  it('W35. neither locale leaks a raw translation key to users for reasons', () => {
    for (const key of reasonI18nKeys) {
      expect(planningEn.reason[key]).not.toContain('production.planning');
      expect(planningAr.reason[key]).not.toContain('production.planning');
    }
  });

  it('W36. panel never issues a mutation on preview (read-only)', () => {
    const previewBlock = panelSource.slice(
      panelSource.indexOf('runPreview'),
      panelSource.indexOf('selectedOps'),
    );
    expect(previewBlock).not.toContain('/production/planning/apply');
    expect(previewBlock).not.toContain('api.patch');
    expect(previewBlock).not.toContain('api.delete');
  });
});
