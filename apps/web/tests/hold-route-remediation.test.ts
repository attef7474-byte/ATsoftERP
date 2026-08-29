import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '../../..');
const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const exists = (rel: string) => fs.existsSync(path.join(repoRoot, rel));

const HOLD_ROUTES: { url: string; page: string }[] = [
  { url: '/admin/inventory/warehouses/new', page: 'apps/web/src/app/admin/inventory/warehouses/new/page.tsx' },
  { url: '/admin/inventory/counts/history', page: 'apps/web/src/app/admin/inventory/counts/history/page.tsx' },
  { url: '/admin/maintenance/requests/new', page: 'apps/web/src/app/admin/maintenance/requests/new/page.tsx' },
  { url: '/admin/maintenance/tasks/new', page: 'apps/web/src/app/admin/maintenance/tasks/new/page.tsx' },
  { url: '/admin/maintenance/schedules/new', page: 'apps/web/src/app/admin/maintenance/schedules/new/page.tsx' },
  { url: '/admin/maintenance/machine-documents/new', page: 'apps/web/src/app/admin/maintenance/machine-documents/new/page.tsx' },
];

function walkDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkDir(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const holdPageAbs = new Set(HOLD_ROUTES.map((r) => path.join(repoRoot, r.page)));
const srcFiles = walkDir(path.join(webRoot, 'src')).filter((f) => !holdPageAbs.has(f));

describe('hold-route remediation contract (DEAD-ROUTES-PHASE1)', () => {
  it.each(HOLD_ROUTES)('hold page is still present: $url', ({ url, page }) => {
    expect(exists(page)).toBe(true);
    expect(url.startsWith('/admin/')).toBe(true);
  });

  it('no navigation in apps/web/src points to any hold-route URL', () => {
    const offenders = srcFiles
      .filter((f) => HOLD_ROUTES.some((r) => fs.readFileSync(f, 'utf8').includes(r.url)))
      .map((f) => path.relative(repoRoot, f));
    expect(offenders).toEqual([]);
  });

  it('legacy /new tool references are fully migrated', () => {
    const testFinalUi = read('test-final-ui.js');
    expect(testFinalUi).not.toContain("url: '/admin/inventory/warehouses/new'");
    expect(testFinalUi).not.toContain("url: '/admin/maintenance/requests/new'");
    expect(testFinalUi).not.toContain("url: '/admin/maintenance/tasks/new'");

    const fullAudit = read('tools/health/full-audit.mjs');
    expect(fullAudit).not.toContain("testPage('Warehouses New'");
    expect(fullAudit).not.toContain("testPage('Counts History'");

    const smokeCheck = read('tools/regression/smoke-check.ps1');
    expect(smokeCheck).not.toContain('"/admin/maintenance/requests/new"');
  });
});

describe('active flows carry migrated hold-route capabilities', () => {
  const schedules = read('apps/web/src/app/admin/maintenance/schedules/page.tsx');
  const machineDocs = read('apps/web/src/app/admin/maintenance/machine-documents/page.tsx');
  const counts = read('apps/web/src/app/admin/inventory/counts/page.tsx');

  it('schedules create/edit form sends endDate and prefills it from the record', () => {
    expect(schedules).toContain("t('maintenance.endDate')");
    expect(schedules).toContain('if (form.endDate) payload.endDate = form.endDate;');
    expect(schedules).toContain('endDate: item.endDate ? item.endDate.split');
  });

  it('machine-documents create form requires fileUrl (label, validation, payload, prefill)', () => {
    expect(machineDocs).toContain("t('maintenance.fileUrl')");
    expect(machineDocs).toContain("if (!form.fileUrl.trim()) errors.fileUrl = t('validation.required');");
    expect(machineDocs).toContain('fileUrl: form.fileUrl.trim()');
    expect(machineDocs).toContain("fileUrl: item.fileUrl || ''");
  });

  it('counts list exposes history columns startedAt/completedAt', () => {
    expect(counts).toContain("t('inventoryCounting.startedAt')");
    expect(counts).toContain("t('inventoryCounting.completedAt')");
  });
});

describe('i18n keys consumed by migrated active flows exist in both locales', () => {
  const enMaintenance = read('apps/web/src/lib/i18n/locales/en/maintenance.ts');
  const arMaintenance = read('apps/web/src/lib/i18n/locales/ar/maintenance.ts');
  const enInventory = read('apps/web/src/lib/i18n/locales/en/inventory.ts');
  const arInventory = read('apps/web/src/lib/i18n/locales/ar/inventory.ts');

  it.each([
    ['endDate', enMaintenance, arMaintenance],
    ['fileUrl', enMaintenance, arMaintenance],
    ['startedAt', enInventory, arInventory],
    ['completedAt', enInventory, arInventory],
  ])('%s is defined in english and arabic locale files', (key, en, ar) => {
    expect(en).toMatch(new RegExp(`\\b${key}\\s*:`));
    expect(ar).toMatch(new RegExp(`\\b${key}\\s*:`));
  });
});