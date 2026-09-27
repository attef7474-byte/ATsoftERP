/**
 * R2-H frontend proof: the retired legacy maintenance part-usage and
 * request-cost pages must be read-only historical views, the request detail
 * page must render the canonical close-readiness blockers, and no frontend
 * callsite may still attempt a write to a path the API now refuses.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const read = (p: string) => fs.readFileSync(path.join(repoRoot, p), 'utf8');

const requestRoot = 'apps/web/src/app/admin/maintenance/requests/[id]';
const costPage = read(`${requestRoot}/cost/page.tsx`);
const partsPage = read(`${requestRoot}/parts/page.tsx`);
const detailPage = read(`${requestRoot}/page.tsx`);

const WRITE_METHODS = ['api.post', 'api.patch', 'api.put', 'api.delete'];

describe('R2-H legacy cost page is a read-only historical view', () => {
  it('performs no write against the retired legacy cost path', () => {
    for (const method of WRITE_METHODS) {
      expect(costPage).not.toContain(method);
    }
  });

  it('does not call the retired legacy cost endpoint for mutation', () => {
    expect(costPage).not.toMatch(/api\.(post|patch|put|delete)\(\s*[`'"]\/maintenance\/request-costs/);
  });

  it('keeps the historical read available', () => {
    expect(costPage).toContain("api.get<MaintenanceRequestCostEntry[]>('/maintenance/request-costs'");
  });

  it('shows the canonical ledger total', () => {
    expect(costPage).toContain('/maintenance-cost/requests/${id}/cost-summary');
    expect(costPage).toContain('summary.netCost');
  });

  it('labels the legacy rows as legacy and excluded from the total', () => {
    expect(costPage).toContain('maintenanceWorkflow.legacyCostTitle');
    expect(costPage).toContain('maintenanceWorkflow.legacyCostReadOnlyNotice');
    expect(costPage).toContain('maintenanceWorkflow.legacyCostExcludedNotice');
  });
});

describe('R2-H legacy parts page is a read-only historical view', () => {
  it('performs no write against the retired legacy part-usage path', () => {
    for (const method of WRITE_METHODS) {
      expect(partsPage).not.toContain(method);
    }
  });

  it('does not call the retired legacy part-usage endpoint for mutation', () => {
    expect(partsPage).not.toMatch(/api\.(post|patch|put|delete)\(\s*[`'"]\/maintenance\/request-parts/);
  });

  it('keeps the historical read available', () => {
    expect(partsPage).toContain("api.get<MaintenanceRequestPartUsage[]>('/maintenance/request-parts'");
  });

  it('states that legacy rows are excluded from canonical totals', () => {
    expect(partsPage).toContain('maintenanceWorkflow.legacyPartsReadOnlyNotice');
    expect(partsPage).toContain('maintenanceWorkflow.legacyPartsExcludedNotice');
  });
});

describe('R2-H request detail renders canonical close readiness', () => {
  it('reads readiness from the canonical endpoint', () => {
    expect(detailPage).toContain('close-readiness');
  });

  it('renders every blocker code the API can return', () => {
    for (const code of [
      'OPEN_TASKS', 'UNRESOLVED_REQUIRED_PARTS', 'ACTIVE_WORK_ORDERS',
      'MANDATORY_CHECKLIST_PENDING', 'REQUEST_NOT_COMPLETED',
    ]) {
      expect(detailPage).toContain(code);
    }
  });

  it('shows the blocker count and the ready state', () => {
    expect(detailPage).toContain('closeReadiness.closeBlockers');
    expect(detailPage).toContain('maintenanceWorkflow.closeReadinessReady');
    expect(detailPage).toContain('maintenanceWorkflow.closeReadinessBlocked');
  });
});

describe('R2-H no frontend callsite writes to any retired legacy path', () => {
  it('has zero write callsites for request-costs or request-parts', () => {
    const roots = [
      'apps/web/src/app',
      'apps/web/src/components',
      'apps/web/src/lib',
    ];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        const src = fs.readFileSync(full, 'utf8');
        if (/api\.(post|patch|put|delete)\([^)]*\/maintenance\/request-(costs|parts)/.test(src)) {
          offenders.push(path.relative(repoRoot, full));
        }
      }
    };
    for (const r of roots) walk(path.join(repoRoot, r));
    expect(offenders).toEqual([]);
  });
});
