import * as fs from 'fs';
import * as path from 'path';
import {
  expectedLifeFormNumber,
  expectedLifeStatusKey,
  expectedLifeUnitKey,
  formatExpectedLifeUnit,
  formatExpectedLifeValue,
  readingTypeForUnit,
} from '../src/lib/maintenance/expected-life-display';

const webRoot = path.resolve(__dirname, '..');
const apiRoot = path.resolve(__dirname, '../../api');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');
const readApi = (rel: string) => fs.readFileSync(path.resolve(apiRoot, rel), 'utf8');

const SERVICE = 'src/modules/factory/maintenance/installed-parts-replacement/installed-parts-replacement.service.ts';
const CONTROLLER = 'src/modules/factory/maintenance/installed-parts-replacement/installed-parts-replacement.controller.ts';
const MIGRATION = 'prisma/migrations/20261120150000_add_spare_part_default_expected_life/migration.sql';
const DETAIL = 'src/app/admin/installed-parts/[id]/page.tsx';
const INSTALLED_LIST = 'src/app/admin/installed-parts/page.tsx';
const CARDS = 'src/components/admin/maintenance/installed-parts-card.tsx';
const SPARE_PART_FORM = 'src/app/admin/maintenance/spare-parts/page.tsx';
const RELIABILITY = 'src/app/admin/maintenance/reliability/installed-parts/page.tsx';
const EN_MAINT = 'src/lib/i18n/locales/en/maintenance.ts';
const AR_MAINT = 'src/lib/i18n/locales/ar/maintenance.ts';
const PERMISSION_KEYS = 'src/lib/permission-keys.ts';
const SEED = 'prisma/seed/seed.ts';

const EN_LABELS: Record<string, string> = {
  'maintenance.lifeUnitDays': 'Days',
  'maintenance.lifeUnitHours': 'Operating Hours',
  'maintenance.lifeUnitCycles': 'Cycles',
  'maintenance.lifeUnitUnknown': 'Unknown unit',
  'maintenance.lifeStatusUnknown': 'Unknown',
  'maintenance.lifeNotDefined': 'Not defined',
};
const t = (key: string) => EN_LABELS[key] ?? key;

describe('Spare-part expected life — Phase 3 frontend contract', () => {
  describe('localized display helper', () => {
    it('maps only the three canonical units to translation keys', () => {
      expect(expectedLifeUnitKey('DAYS')).toBe('maintenance.lifeUnitDays');
      expect(expectedLifeUnitKey('HOURS')).toBe('maintenance.lifeUnitHours');
      expect(expectedLifeUnitKey('CYCLES')).toBe('maintenance.lifeUnitCycles');
      expect(expectedLifeUnitKey('WEEKS')).toBe('maintenance.lifeUnitUnknown');
      expect(expectedLifeUnitKey(null)).toBe('maintenance.lifeUnitUnknown');
    });

    it('never exposes a raw status enum when the status is unknown', () => {
      expect(expectedLifeStatusKey('NORMAL')).toBe('maintenance.lifeStatusNormal');
      expect(expectedLifeStatusKey('BOGUS')).toBe('maintenance.lifeStatusUnknown');
      expect(expectedLifeStatusKey(null)).toBe('maintenance.lifeStatusUnknown');
    });

    it('formats backend-calculated values without recalculating them', () => {
      expect(formatExpectedLifeValue(t, 8000, 'HOURS')).toBe('8000 Operating Hours');
      expect(formatExpectedLifeValue(t, 0, 'CYCLES')).toBe('0 Cycles');
      expect(formatExpectedLifeValue(t, null, 'DAYS')).toBe('Not defined');
      expect(formatExpectedLifeUnit(t, 'DAYS')).toBe('Days');
    });

    it('selects only meter reading types for HOURS/CYCLES', () => {
      expect(readingTypeForUnit('HOURS')).toBe('HOURS');
      expect(readingTypeForUnit('CYCLES')).toBe('CYCLES');
      expect(readingTypeForUnit('DAYS')).toBe('HOURS');
    });

    it('preserves numeric zero when prefilling form inputs', () => {
      expect(expectedLifeFormNumber(0)).toBe('0');
      expect(expectedLifeFormNumber(null)).toBe('');
      expect(expectedLifeFormNumber(undefined)).toBe('');
      expect(expectedLifeFormNumber('')).toBe('');
      expect(expectedLifeFormNumber(100)).toBe('100');
    });
  });

  describe('exact bilingual unit labels', () => {
    it('uses the approved English labels', () => {
      const en = read(EN_MAINT);
      expect(en).toContain("lifeUnitDays: 'Days'");
      expect(en).toContain("lifeUnitHours: 'Operating Hours'");
      expect(en).toContain("lifeUnitCycles: 'Cycles'");
    });

    it('uses the approved Arabic labels', () => {
      const ar = read(AR_MAINT);
      expect(ar).toContain("lifeUnitDays: 'أيام'");
      expect(ar).toContain("lifeUnitHours: 'ساعات تشغيل'");
      expect(ar).toContain("lifeUnitCycles: 'دورات'");
    });
  });

  describe('catalog default life UX', () => {
    it('uses the real spare-part create/update API with additive nullable fields', () => {
      const form = read(SPARE_PART_FORM);
      expect(form).toContain('defaultExpectedLifeValue');
      expect(form).toContain('defaultExpectedLifeUnit');
      expect(form).toContain('defaultWarningThresholdPercent');
      expect(form).toContain('formatExpectedLifeValue');
      expect(form).toContain('defaultLifePairRequired');
      expect(form).toContain("api.post<SparePart>('/maintenance/spare-parts'");
      expect(form).toContain('api.patch');
    });
  });

  describe('installed-part snapshot UX', () => {
    it('shows standard vs applied life and backend-calculated consumption', () => {
      for (const source of [DETAIL, INSTALLED_LIST, CARDS]) {
        const text = read(source);
        expect(text).toContain('formatExpectedLifeValue');
        expect(text).toContain('standardExpectedLife');
        expect(text).toContain('appliedExpectedLife');
        expect(text).toContain('consumedLife');
        expect(text).toContain('remainingLife');
      }
      const detail = read(DETAIL);
      expect(detail).toContain('data-testid="installed-part-standard-life"');
      expect(detail).toContain('data-testid="installed-part-applied-life"');
      expect(detail).toContain('data-testid="installed-part-life-consumption"');
      expect(detail).toContain('data-testid="installed-part-life-progress"');
      expect(detail).toContain('data-testid="installed-part-reading-history"');
      expect(detail).toContain('lifeSnapshotHint');
    });

    it('uses real expected-life and reading endpoints with seeded permissions', () => {
      const detail = read(DETAIL);
      expect(detail).toContain("api.patch(`/installed-parts/${params.id}/expected-life`");
      expect(detail).toContain("api.post(`/installed-parts/${params.id}/readings`");
      expect(detail).toContain("api.get<MachineInstalledPartReading[]>('/installed-parts/' + params.id + '/readings')");
      expect(detail).toContain('PERMISSION_KEYS.MACHINE_UPDATE');
      expect(read(PERMISSION_KEYS)).toContain("MACHINE_UPDATE: 'machine:update'");
      const seed = readApi(SEED);
      expect(seed).toContain('"machine"');
      expect(seed).toContain('"update"');
    });

    it('blocks meter readings for DAYS-based life and preserves reset intent', () => {
      const detail = read(DETAIL);
      expect(detail).toContain('readingDisabledForDays');
      expect(detail).toContain('readingTypeForUnit');
      expect(detail).toContain('isReset');
      expect(detail).toContain('isReset: readingForm.isReset');
    });

    it('prefills numeric-zero readings without truncating them', () => {
      const detail = read(DETAIL);
      expect(detail).toContain('expectedLifeFormNumber');
      expect(detail).not.toContain("?? '' ? String(");
      expect(detail).not.toContain("?? '' !== ''");
    });
  });

  describe('reliability lifecycle drill-through', () => {
    it('opens the concrete installed-part instance from the lifecycle column', () => {
      const reliability = read(RELIABILITY);
      expect(reliability).toContain("from 'next/navigation'");
      expect(reliability).toContain('useRouter');
      expect(reliability).toContain('iprColLifecycle');
      expect(reliability).toContain('iprOpenInstalledPart');
      expect(reliability).toContain('router.push(`/admin/installed-parts/${r.current.id}`)');
      expect(reliability).toContain('LifeStatusBadge');
      expect(reliability).toContain('data-testid="ipr-open-installed-part"');
    });
  });

  describe('backend authority and additive migration', () => {
    it('uses one calculator, one shared inheritance boundary and no stock writes', () => {
      const service = readApi(SERVICE);
      const calculatorMatches = service.match(/export function computeExpectedLifeState\(/g) ?? [];
      expect(calculatorMatches).toHaveLength(1);
      expect(service).toContain('export const DUE_PROGRESS_THRESHOLD = 0.9;');
      expect(service).toContain('private async buildInstalledPartLifeSnapshot(');
      expect(service).toContain('const lifeSnapshot = await this.buildInstalledPartLifeSnapshot(');
      expect(service).toContain('buildInstalledPartLifeView');
      expect(service).not.toContain('inventoryMovement.create');
      expect(service).not.toContain('inventoryBalance.create');
      expect(service).not.toContain('inventoryBalance.update');
      expect(service).not.toContain('product.update');
    });

    it('exposes the reused expected-life and reading endpoints', () => {
      const controller = readApi(CONTROLLER);
      expect(controller).toContain("@Patch(':id/expected-life')");
      expect(controller).toContain("@Post(':id/readings')");
      expect(controller).toContain("@Get(':id/readings')");
      expect(controller).toContain("@Permissions('machine:update')");
      expect(controller).toContain("@Permissions('installed-parts:read')");
    });

    it('adds only nullable catalog columns and does not backfill', () => {
      const migration = readApi(MIGRATION);
      expect(migration).toContain('ALTER TABLE [dbo].[spare_parts] ADD [default_expected_life_value] FLOAT NULL');
      expect(migration).toContain('ALTER TABLE [dbo].[spare_parts] ADD [default_expected_life_unit] NVARCHAR(20) NULL');
      expect(migration).toContain('ALTER TABLE [dbo].[spare_parts] ADD [default_warning_threshold_percent] INT NULL');
      expect(migration).not.toMatch(/\bINSERT\b/i);
      expect(migration).not.toMatch(/\bUPDATE\b/i);
      expect(migration).not.toContain('default_due_threshold_percent');
    });
  });
});
