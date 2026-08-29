import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '../../..');
const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const exists = (rel: string) => fs.existsSync(path.join(repoRoot, rel));

const STILL_HOLD_ROUTES: { url: string; page: string }[] = [
  { url: '/admin/maintenance/requests/new', page: 'apps/web/src/app/admin/maintenance/requests/new/page.tsx' },
  { url: '/admin/maintenance/tasks/new', page: 'apps/web/src/app/admin/maintenance/tasks/new/page.tsx' },
];

const DELETED_DETAIL_SLUGS: { url: string; page: string; reservedHelper: string }[] = [
  {
    url: '/admin/inventory/warehouses/new',
    page: 'apps/web/src/app/admin/inventory/warehouses/new/page.tsx',
    reservedHelper: 'isReservedDetailRouteId',
  },
  {
    url: '/admin/inventory/counts/history',
    page: 'apps/web/src/app/admin/inventory/counts/history/page.tsx',
    reservedHelper: 'isReservedDetailRouteIdFor',
  },
  {
    url: '/admin/maintenance/schedules/new',
    page: 'apps/web/src/app/admin/maintenance/schedules/new/page.tsx',
    reservedHelper: 'isReservedDetailRouteId',
  },
  {
    url: '/admin/maintenance/machine-documents/new',
    page: 'apps/web/src/app/admin/maintenance/machine-documents/new/page.tsx',
    reservedHelper: 'isReservedDetailRouteId',
  },
];

const ALL_ROUTE_URLS = [...STILL_HOLD_ROUTES, ...DELETED_DETAIL_SLUGS].map((r) => r.url);

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

describe('hold-route remediation contract (DEAD-ROUTES-PHASE1)', () => {
  it.each(STILL_HOLD_ROUTES)('STILL_HOLD route remains intentionally present: $url', ({ url, page }) => {
    expect(exists(page)).toBe(true);
    expect(url.startsWith('/admin/')).toBe(true);
  });

  it.each(DELETED_DETAIL_SLUGS)('deleted route page no longer exists: $url', ({ url, page }) => {
    expect(exists(page)).toBe(false);
    expect(url.startsWith('/admin/')).toBe(true);
  });

  it('no navigation in apps/web/src points to any hold-route or deleted-route URL', () => {
    const middlewareAbs = path.join(webRoot, 'src', 'middleware.ts');
    const srcFiles = walkDir(path.join(webRoot, 'src')).filter(
      (f) =>
        f !== middlewareAbs &&
        !STILL_HOLD_ROUTES.some((r) => path.join(repoRoot, r.page) === f),
    );
    const offenders = srcFiles
      .filter((f) => ALL_ROUTE_URLS.some((url) => fs.readFileSync(f, 'utf8').includes(url)))
      .map((f) => path.relative(repoRoot, f));
    expect(offenders).toEqual([]);
  });

  it('middleware intentionally 404s each deleted route (guard, not navigation)', () => {
    const middleware = read('apps/web/src/middleware.ts');
    expect(middleware).toContain("'/admin/inventory/warehouses/new'");
    expect(middleware).toContain("'/admin/inventory/counts/history'");
    expect(middleware).toContain("'/admin/maintenance/schedules/new'");
    expect(middleware).toContain("'/admin/maintenance/machine-documents/new'");
    expect(middleware).toContain('status: 404');
  });

  it('legacy /new and /history tool references are fully migrated', () => {
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

describe('deleted route detail pages reject reserved slugs before detail fetch', () => {
  it.each(DELETED_DETAIL_SLUGS)('$url guarded in detail page via $reservedHelper', ({ page, reservedHelper }) => {
    const detailPage = page.replace(/\/new\/page\.tsx$/, '/[id]/page.tsx').replace(/\/history\/page\.tsx$/, '/[id]/page.tsx');
    expect(exists(detailPage)).toBe(true);
    const content = read(detailPage);
    expect(content).toContain(reservedHelper);
    expect(content).toMatch(/notFound\(\)/);
  });
});

describe('active flows retain the migrated capabilities of deleted routes', () => {
  const schedules = read('apps/web/src/app/admin/maintenance/schedules/page.tsx');
  const machineDocs = read('apps/web/src/app/admin/maintenance/machine-documents/page.tsx');
  const counts = read('apps/web/src/app/admin/inventory/counts/page.tsx');
  const warehouses = read('apps/web/src/app/admin/inventory/warehouses/page.tsx');

  it('warehouse active create flow retains required fields (companyId, name, branchId, location, warehouseType)', () => {
    expect(warehouses).toContain("useState({ companyId: '', branchId: '', name: '', location: '', warehouseType: '' })");
    expect(warehouses).toContain("if (!form.companyId) errs.companyId = t('validation.required');");
    expect(warehouses).toContain("if (!form.name) errs.name = t('validation.required');");
    expect(warehouses).toContain("adapter={companyAdapter}");
    expect(warehouses).toContain("adapter={branchAdapter}");
  });

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
    expect(counts).toContain('r.startedAt ? r.startedAt.split');
    expect(counts).toContain('r.completedAt ? r.completedAt.split');
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

describe('active requests create modal reaches legacy /new parity (DEAD-ROUTES-PHASE1-FINAL2)', () => {
  const requests = read('apps/web/src/app/admin/maintenance/requests/page.tsx');

  it('exposes the operational-context selectors legacy /new supported (productionLine, machineComponent, operationType, costCenter)', () => {
    expect(requests).toContain('adapter={productionLineAdapter}');
    expect(requests).toContain('adapter={machineComponentAdapter}');
    expect(requests).toContain('adapter={operationTypeAdapter}');
    expect(requests).toContain('adapter={costCenterAdapter}');
    expect(requests).toContain("filters={{ machineId: form.machineId }}");
    expect(requests).toContain('filters={{ machineId: form.machineId, componentId: form.machineComponentId }}');
  });

  it('auto-fills operational context from the selected machine (productionLine, operationType, defaultCostCenter)', () => {
    expect(requests).toContain('productionLineId: machine.productionLineId');
    expect(requests).toContain('operationTypeId: machine.operationTypeId');
    expect(requests).toContain('costCenterId: machine.defaultCostCenterId');
    expect(requests).toContain('onItemSelect={handleMachineSelect}');
  });

  it('sends notes to the backend payload', () => {
    expect(requests).toContain("if (form.notes) payload.notes = form.notes;");
    expect(requests).toContain("t('maintenance.notes')");
  });

  it('exposes required-parts editing (add/remove/sparePart adapter/isPrimary/quantity) wired to the payload', () => {
    expect(requests).toContain('const addRequiredPart = () => {');
    expect(requests).toContain('adapter={sparePartAdapter}');
    expect(requests).toContain('t(\'maintenance.requiredSpareParts\')');
    expect(requests).toContain("t('maintenance.addRequiredPart')");
    expect(requests).toContain('payload.requiredParts = filledParts.map(');
    expect(requests).toContain('(sparePart: SparePart) => handleSparePartSelect(index, sparePart)');
  });

  it('uses backend-valid priority options (URGENT, never CRITICAL)', () => {
    expect(requests).toContain("{ value: 'URGENT', label: t('status.URGENT') }");
    expect(requests).not.toContain("{ value: 'CRITICAL'");
  });

  it('matches the [id]/edit page priority set exactly (full parity, no capability lost)', () => {
    const edit = read('apps/web/src/app/admin/maintenance/requests/[id]/edit/page.tsx');
    expect(requests).toContain("{ value: 'LOW', label: t('status.LOW') }");
    expect(requests).toContain("{ value: 'MEDIUM', label: t('status.MEDIUM') }");
    expect(requests).toContain("{ value: 'HIGH', label: t('status.HIGH') }");
    expect(requests).toContain("{ value: 'URGENT', label: t('status.URGENT') }");
    expect(edit).toContain("{ value: 'LOW', label: 'Low' }");
    expect(edit).toContain("{ value: 'URGENT', label: 'Urgent' }");
    expect(edit).not.toContain("{ value: 'CRITICAL'");
  });

  it('uses the legacy type convention (EMERGENCY, never CALIBRATION)', () => {
    expect(requests).toContain("{ value: 'EMERGENCY', label: t('status.EMERGENCY') }");
    expect(requests).not.toContain("{ value: 'CALIBRATION'");
  });

  it('matches the [id]/edit page and legacy /new request-type set exactly (full parity)', () => {
    const edit = read('apps/web/src/app/admin/maintenance/requests/[id]/edit/page.tsx');
    const legacyNew = read('apps/web/src/app/admin/maintenance/requests/new/page.tsx');
    expect(requests).toContain("{ value: 'CORRECTIVE', label: t('status.CORRECTIVE') }");
    expect(requests).toContain("{ value: 'PREVENTIVE', label: t('status.PREVENTIVE') }");
    expect(requests).toContain("{ value: 'PREDICTIVE', label: t('status.PREDICTIVE') }");
    expect(requests).toContain("{ value: 'EMERGENCY', label: t('status.EMERGENCY') }");
    expect(edit).toContain("{ value: 'EMERGENCY', label: 'Emergency' }");
    expect(legacyNew).toContain("{ value: 'EMERGENCY', label: 'Emergency' }");
    expect(edit).not.toContain("{ value: 'CALIBRATION'");
    expect(legacyNew).not.toContain("{ value: 'CALIBRATION'");
    expect(requests).not.toContain("{ value: 'CALIBRATION'");
  });
});

describe('CmmsPriorityBadge maps every emitted priority to a distinct color (DEAD-ROUTES-PHASE1-FINAL2)', () => {
  const badge = read('apps/web/src/components/maintenance/CmmsPriorityBadge.tsx');

  it('maps URGENT (backend-valid top request priority) so it is no longer default gray', () => {
    expect(badge).toContain("URGENT: 'bg-red-100 text-red-800'");
  });

  it('keeps CRITICAL mapping because work-orders still emits CRITICAL', () => {
    const workOrders = read('apps/web/src/app/admin/maintenance/work-orders/page.tsx');
    expect(workOrders).toContain("'CRITICAL'");
    expect(badge).toContain("CRITICAL: 'bg-red-100 text-red-800'");
  });

  it('keeps LOW/MEDIUM/HIGH mappings (full priority color coverage)', () => {
    expect(badge).toContain("LOW: 'bg-gray-100 text-gray-800'");
    expect(badge).toContain("MEDIUM: 'bg-blue-100 text-blue-800'");
    expect(badge).toContain("HIGH: 'bg-orange-100 text-orange-800'");
  });

  it('translates URGENT via the shared status namespace (label, not raw key)', () => {
    const literals = read('apps/web/src/lib/i18n/literals.ts');
    const enCommon = read('apps/web/src/lib/i18n/locales/en/common.ts');
    const arCommon = read('apps/web/src/lib/i18n/locales/ar/common.ts');
    expect(literals).toContain('translatePriority');
    expect(enCommon).toMatch(/\bURGENT\s*:\s*'Urgent'/);
    expect(arCommon).toMatch(/\bURGENT\s*:\s*'عاجلة'/);
  });
});

describe('requests create backend accepts the exposed request priorities/types (DEAD-ROUTES-PHASE1-FINAL2)', () => {
  it('priority enum allows URGENT and excludes CRITICAL', () => {
    const dto = read('apps/api/src/modules/factory/maintenance/maintenance-requests/dto/create-maintenance-request.dto.ts');
    expect(dto).toContain("@IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])");
    expect(dto).not.toContain('CRITICAL');
  });

  it('request DTO supports notes and requiredParts nested create', () => {
    const dto = read('apps/api/src/modules/factory/maintenance/maintenance-requests/dto/create-maintenance-request.dto.ts');
    expect(dto).toContain('notes?: string;');
    expect(dto).toContain('requiredParts?: CreateRequiredPartDto[];');
    expect(dto).toContain('productionLineId?: string;');
    expect(dto).toContain('machineComponentId?: string;');
    expect(dto).toContain('operationTypeId?: string;');
    expect(dto).toContain('costCenterId?: string;');
  });
});

describe('active tasks create modal reaches legacy /new parity (notes)', () => {
  const tasks = read('apps/web/src/app/admin/maintenance/tasks/page.tsx');

  it('exposes the notes field in create/edit and sends it to the API', () => {
    expect(tasks).toContain("notes: ''");
    expect(tasks).toContain("notes: item.notes || ''");
    expect(tasks).toContain('if (form.notes) payload.notes = form.notes;');
    expect(tasks).toContain("t('maintenance.notes')");
  });
});

describe('tasks create backend accepts notes', () => {
  it('CreateMaintenanceTaskDto supports notes', () => {
    const dto = read('apps/api/src/modules/factory/maintenance/maintenance-tasks/dto/create-maintenance-task.dto.ts');
    expect(dto).toContain('notes?: string;');
  });
});
