import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const apiRoot = path.resolve(__dirname, '../../api');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');
const readApi = (rel: string) => fs.readFileSync(path.resolve(apiRoot, rel), 'utf8');

const PAGE = 'src/app/admin/maintenance/reliability/alerts/page.tsx';
const SCHEDULES = 'src/app/admin/maintenance/schedules/page.tsx';
const NAV = 'src/components/admin/shell/navigation-data.ts';
const PERMISSION_KEYS = 'src/lib/permission-keys.ts';
const EN_MAINT = 'src/lib/i18n/locales/en/maintenance.ts';
const AR_MAINT = 'src/lib/i18n/locales/ar/maintenance.ts';
const EN_NAV = 'src/lib/i18n/locales/en/navigation.ts';
const AR_NAV = 'src/lib/i18n/locales/ar/navigation.ts';

const MODULE = 'src/modules/factory/maintenance/maintenance-reliability';
const ALERT_CALC = `${MODULE}/reliability-alert-calculations.ts`;
const ALERT_SERVICE = `${MODULE}/reliability-alerts.service.ts`;
const ALERT_CONTROLLER = `${MODULE}/reliability-alerts.controller.ts`;
const THRESHOLDS = `${MODULE}/reliability-alert-thresholds.service.ts`;
const DTO = `${MODULE}/dto/reliability-alert.dto.ts`;
const MODULE_FILE = `${MODULE}/maintenance-reliability.module.ts`;

describe('Reliability alerts + preventive planning (read-only, derived)', () => {
  describe('W1/W2. The canonical alert page renders with shared UI and human identity', () => {
    it('renders with header, data table and pagination', () => {
      const page = read(PAGE);
      expect(page).toContain("t('maintenance.reliabilityAlertsTitle')");
      expect(page).toContain('<PageHeader');
      expect(page).toContain('<DataTable');
      expect(page).toContain('<Pagination');
      expect(page).toContain('<Modal');
    });
    it('columns use human-readable identity, never raw ids', () => {
      const page = read(PAGE);
      expect(page).toContain('a.machine.code');
      expect(page).toContain('a.sparePart.code');
      expect(page).toContain('a.machineComponent');
      expect(page).toContain('a.productionLine');
    });
  });

  describe('W3. Filters drive the query through canonical F9 lookups (§42)', () => {
    it('uses the shared F9 adapters', () => {
      const page = read(PAGE);
      expect(page).toContain('machineAdapter');
      expect(page).toContain('machineComponentAdapter');
      expect(page).toContain('sparePartAdapter');
      expect(page).toContain('productionLineAdapter');
    });
    it('query params include the alert filters', () => {
      const page = read(PAGE);
      for (const p of ['p.machineId', 'p.machineComponentId', 'p.sparePartId', 'p.productionLineId', 'p.alertType', 'p.severity', 'p.dueState', 'p.isCritical', 'p.search']) {
        expect(page).toContain(p);
      }
    });
  });

  describe('W4. Summary metrics are present (§38)', () => {
    it('shows the segment counts', () => {
      const page = read(PAGE);
      expect(page).toContain('summary.approaching');
      expect(page).toContain('summary.due');
      expect(page).toContain('summary.overdue');
      expect(page).toContain('summary.repeatedPrematureFailure');
      expect(page).toContain('summary.highReplacementFrequency');
    });
  });

  describe('W5. Data-quality / eligibility panel is honest (§56)', () => {
    it('renders the data-quality card with the honesty note', () => {
      const page = read(PAGE);
      expect(page).toContain("t('maintenance.ralDataQuality')");
      expect(page).toContain("t('maintenance.ralDqNote')");
      expect(page).toContain('dq.unknownExpectedLife');
      expect(page).toContain('dq.replacementFrequencyThresholdConfigured');
      expect(page).toContain('dq.notEligibleReasons');
    });
  });

  describe('W6. Details expose the "Why Alerted?" evidence trail (§40/§41)', () => {
    it('renders the evidence explanation', () => {
      const page = read(PAGE);
      expect(page).toContain("t('maintenance.ralWhyAlerted')");
      expect(page).toContain('detail.evidence');
      expect(page).toContain("t('maintenance.ralRecommendedAction')");
      expect(page).toContain('detail.recommendedAction');
    });
  });

  describe('W7. Planning action is permission-gated (§44)', () => {
    it('requires the canonical planning permission', () => {
      const page = read(PAGE);
      expect(page).toContain("isPermissionGranted('maintenance-schedule:create'");
      expect(page).toContain('permissions?.permissions');
      expect(page).toContain('canPlan');
    });
    it('explains the gate when permission is missing', () => {
      expect(read(PAGE)).toContain("t('maintenance.ralPlanNeedsPermission')");
    });
  });

  describe('W8. Planning action prefills the EXISTING canonical form, never a new write path (§30/§31)', () => {
    it('navigates to the existing schedules form with planning query params', () => {
      const page = read(PAGE);
      expect(page).toContain("params.set('planSource', 'reliability')");
      expect(page).toContain("params.set('planMachineId'");
      expect(page).toContain("params.set('planSparePartId'");
      expect(page).toContain("params.set('planComponentId'");
      expect(page).toContain("params.set('planAlertType'");
      expect(page).toContain('router.push(`/admin/maintenance/schedules?${params.toString()}`)');
    });
    it('tells the user nothing is saved until they confirm', () => {
      expect(read(PAGE)).toContain("t('maintenance.ralPlanningNote')");
    });
  });

  describe('W9. The alert page is strictly read-only', () => {
    it('performs only GET requests (no create/update/delete)', () => {
      const page = read(PAGE);
      expect(page).toContain('api.get<');
      expect(page).not.toMatch(/api\.post\(/);
      expect(page).not.toMatch(/api\.patch\(/);
      expect(page).not.toMatch(/api\.put\(/);
      expect(page).not.toMatch(/api\.delete\(/);
    });
  });

  describe('W10. Arabic and English keys are complete', () => {
    it('both locales define every ral key', () => {
      const keys = [
        'reliabilityAlertsTitle', 'ralSubtitle', 'ralFilters', 'ralTotalAlerts',
        'ralApproaching', 'ralDue', 'ralOverdue', 'ralRepeated', 'ralHighFrequency',
        'ralColSeverity', 'ralColType', 'ralColMachine', 'ralColSparePart', 'ralColExpectedDue',
        'ralWhyAlerted', 'ralDataQuality', 'ralDqNote', 'ralPlanAction', 'ralPlanNeedsPermission',
        'ralPlanningNote', 'ralType_LIFE_APPROACHING_DUE', 'ralType_LIFE_DUE', 'ralType_LIFE_OVERDUE',
        'ralType_REPEATED_PREMATURE_FAILURE', 'ralType_HIGH_REPLACEMENT_FREQUENCY',
        'ralAction_INSPECT', 'ralAction_REPLACE', 'ralAction_CONDITION_CHECK', 'ralAction_DIAGNOSE_REPEATED_FAILURE',
        'scheduleFromAlertBanner', 'scheduleFromAlertSource', 'scheduleFromAlertLoadFailed',
      ];
      const en = read(EN_MAINT);
      const ar = read(AR_MAINT);
      for (const k of keys) {
        expect(en).toContain(`${k}:`);
        expect(ar).toContain(`${k}:`);
      }
    });
  });

  describe('W11/W12. Navigation and permission registry (§37/§43)', () => {
    it('adds one navigation entry gated by the existing reliability permission', () => {
      const nav = read(NAV);
      expect(nav).toContain("labelKey: 'navigation.reliabilityAlerts'");
      expect(nav).toContain("route: '/admin/maintenance/reliability/alerts'");
      expect(nav).toContain("permission: 'maintenance-reliability:read'");
    });
    it('both locales translate the navigation label', () => {
      expect(read(EN_NAV)).toContain('reliabilityAlerts:');
      expect(read(AR_NAV)).toContain('reliabilityAlerts:');
    });
    it('reuses the existing seeded reliability permission (no new permission invented)', () => {
      expect(read(PERMISSION_KEYS)).toContain('MAINTENANCE_RELIABILITY_READ');
      expect(readApi('prisma/seed/seed-cmms-permission-keys.ts')).toContain('maintenance-reliability:read');
    });
  });

  describe('W13. The schedules page consumes the prefill without a second subsystem (§31/§35)', () => {
    it('reads the planning query params and prefills the create form', () => {
      const sch = read(SCHEDULES);
      expect(sch).toContain("searchParams.get('planSource')");
      expect(sch).toContain("searchParams.get('planMachineId')");
      expect(sch).toContain("searchParams.get('planSparePartId')");
      expect(sch).toContain("'/maintenance/reliability/alerts/planning-candidate'");
      expect(sch).toContain('openCreate()');
      expect(sch).toContain("type: 'PREVENTIVE'");
    });
    it('shows a from-alert banner and never auto-saves', () => {
      const sch = read(SCHEDULES);
      expect(sch).toContain("t('maintenance.scheduleFromAlertBanner')");
      expect(sch).toContain('fromAlert');
      expect(sch).toContain('useSearchParams');
    });
  });

  describe('W14. Backend routes mirror the web calls and are permission-gated (§50)', () => {
    it('declares the read-only alert routes with the shared permission', () => {
      const controller = readApi(ALERT_CONTROLLER);
      expect(controller).toContain("@Controller({ path: 'maintenance/reliability/alerts', version: '1' })");
      expect(controller).toContain('@Get()');
      expect(controller).toContain("@Get('summary')");
      expect(controller).toContain("@Get('data-quality')");
      expect(controller).toContain("@Get('planning-candidate')");
      expect(controller).toContain("@Permissions('maintenance-reliability:read')");
      expect(controller).not.toMatch(/@Post\(/);
      expect(controller).not.toMatch(/@Patch\(/);
      expect(controller).not.toMatch(/@Put\(/);
      expect(controller).not.toMatch(/@Delete\(/);
    });
    it('wires the controller and providers in the module', () => {
      const mod = readApi(MODULE_FILE);
      expect(mod).toContain('ReliabilityAlertsController');
      expect(mod).toContain('ReliabilityAlertsService');
      expect(mod).toContain('ReliabilityAlertThresholdsService');
    });
  });

  describe('W15. Transition/creation boundaries are preserved (§54/§55)', () => {
    it('the alert engine service performs no writes', () => {
      const service = readApi(ALERT_SERVICE);
      expect(service).not.toMatch(/\.create\(/);
      expect(service).not.toMatch(/\.update\(/);
      expect(service).not.toMatch(/\.delete\(/);
      expect(service).not.toMatch(/\.upsert\(/);
      expect(service).not.toMatch(/\$transaction/);
      expect(service).not.toMatch(/maintenanceWorkOrder\./);
      expect(service).not.toMatch(/maintenanceRequest\./);
      expect(service).not.toMatch(/inventoryMovement\./);
    });
    it('planning never auto-creates a schedule (delegated to the human form)', () => {
      const service = readApi(ALERT_SERVICE);
      expect(service).not.toMatch(/maintenanceSchedule\.create/);
    });
  });

  describe('W16. Thresholds come from canonical configuration, never invented (§10/§11)', () => {
    it('reads the replacement-frequency threshold from a SystemSetting group', () => {
      const t = readApi(THRESHOLDS);
      expect(t).toContain("RELIABILITY_ALERTS_SETTINGS_GROUP = 'reliability-alerts'");
      expect(t).toContain('systemSetting.findMany');
      expect(t).toContain('reliability.alerts.replacementFrequencyWindowDays');
      expect(t).toContain('reliability.alerts.replacementFrequencyMaxCount');
    });
    it('life-band thresholds are consumed from the canonical expected-life result, not re-invented', () => {
      const calc = readApi(ALERT_CALC);
      expect(calc).toContain('expectedLife.configured');
      expect(calc).toContain('expectedLife.band');
      // no magic percentage constants for life derived here
      expect(calc).not.toContain('0.9');
      expect(calc).not.toContain('80');
    });
    it('the frequency category is NOT_ELIGIBLE when unconfigured', () => {
      const calc = readApi(ALERT_CALC);
      expect(calc).toContain('replacementFrequencyWindowDays !== null');
      expect(calc).toContain('replacementFrequencyMaxCount !== null');
    });
  });

  describe('W17. Alert derivation consumes the canonical reliability authority, never re-derives', () => {
    it('does not recompute service life or expected life', () => {
      const calc = readApi(ALERT_CALC);
      expect(calc).not.toContain('computeServiceLifeMs');
      expect(calc).not.toContain('computeExpectedLife(');
      expect(calc).not.toMatch(/installedAt\s*-\s*/);
    });
    it('uses the canonical repeated-early-failure flag', () => {
      expect(readApi(ALERT_CALC)).toContain('repeatedEarlyFailure');
    });
    it('the service consumes the canonical InstalledPartReliabilityService rows', () => {
      const service = readApi(ALERT_SERVICE);
      expect(service).toContain('InstalledPartReliabilityService');
      expect(service).toContain('buildRows');
    });
  });

  describe('W18/W19. Alert taxonomy and severity/action mapping are exactly as locked', () => {
    it('the DTO exposes the five locked alert types', () => {
      const dto = readApi(DTO);
      for (const t of ['LIFE_APPROACHING_DUE', 'LIFE_DUE', 'LIFE_OVERDUE', 'REPEATED_PREMATURE_FAILURE', 'HIGH_REPLACEMENT_FREQUENCY']) {
        expect(dto).toContain(t);
      }
    });
    it('base severity and recommended action per type are locked in the calc module', () => {
      const calc = readApi(ALERT_CALC);
      expect(calc).toContain("LIFE_APPROACHING_DUE: 'LOW'");
      expect(calc).toContain("LIFE_DUE: 'MEDIUM'");
      expect(calc).toContain("LIFE_OVERDUE: 'HIGH'");
      expect(calc).toContain("REPEATED_PREMATURE_FAILURE: 'HIGH'");
      expect(calc).toContain("HIGH_REPLACEMENT_FREQUENCY: 'MEDIUM'");
      expect(calc).toContain("LIFE_APPROACHING_DUE: 'INSPECT'");
      expect(calc).toContain("REPEATED_PREMATURE_FAILURE: 'DIAGNOSE_REPEATED_FAILURE'");
    });
    it('severity may only be raised by canonical criticality (component CRITICAL or spare-part critical)', () => {
      const calc = readApi(ALERT_CALC);
      expect(calc).toContain('criticalityOf');
      expect(calc).toContain("=== 'CRITICAL'");
      expect(calc).toContain('isCritical');
    });
  });

  describe('W20. Deduplication identity is stable and never by name (§15)', () => {
    it('life alerts dedupe on installedPartId + type; failure alerts on machine + sparePart + type', () => {
      const calc = readApi(ALERT_CALC);
      expect(calc).toContain('`${row.current.id}:${type}`');
      expect(calc).toContain('`${row.machine.id}:${row.sparePart.id}:${type}`');
      expect(calc).not.toContain('row.sparePart.name}:');
    });
  });

  describe('W21. Planning candidate contract (§50)', () => {
    it('returns a prefill plus duplicate detection', () => {
      const service = readApi(ALERT_SERVICE);
      expect(service).toContain('getPlanningCandidate');
      expect(service).toContain('prefill');
      expect(service).toContain('existingOpenPlans');
      expect(service).toContain('hasExistingOpenPlan');
      expect(service).toContain('sourceReference');
    });
    it('detects an existing open preventive plan server-side', () => {
      const service = readApi(ALERT_SERVICE);
      expect(service).toContain("status: 'ACTIVE'");
      expect(service).toContain("type: 'PREVENTIVE'");
    });
  });

  describe('W22. Tenant isolation is enforced in the backend, not the frontend (§43)', () => {
    it('delegates scoping to the canonical reliability layer which scopes by owning machine', () => {
      const service = readApi(ALERT_SERVICE);
      expect(service).toContain('this.installedPartReliability.buildRows(query, ctx)');
    });
    it('the page sends no tenant header/filter of its own', () => {
      const page = read(PAGE);
      expect(page).not.toContain('x-active-company-id');
      expect(page).not.toContain('companyId');
    });
  });

  describe('§66 F9 regression: the shared lookup pattern is reused, not replaced', () => {
    it('both pages use the shared F9Lookup component', () => {
      expect(read(PAGE)).toContain('<F9Lookup');
      expect(read(SCHEDULES)).toContain('F9Lookup');
    });
    it('no page defines a bespoke lookup input', () => {
      expect(read(PAGE)).not.toContain('AutoCompleteLookup');
      expect(read(PAGE)).not.toContain('LookupModal');
    });
  });
});
