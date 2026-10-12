import fs from 'node:fs';
import path from 'node:path';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { resolveTranslation, TRANSLATION_FALLBACKS } from '../src/lib/i18n/translation-core';

const webSrc = path.resolve(__dirname, '../src');
const apiSrc = path.resolve(__dirname, '../../api/src');
const readWeb = (rel: string) => fs.readFileSync(path.join(webSrc, rel), 'utf8');
const readApi = (rel: string) => fs.readFileSync(path.join(apiSrc, rel), 'utf8');

const WORK_ORDERS_CONTROLLER =
  'modules/factory/maintenance/maintenance-work-orders/maintenance-work-orders.controller.ts';
const REQUESTS_CONTROLLER =
  'modules/factory/maintenance/maintenance-requests/maintenance-requests.controller.ts';

describe('execution form source-detail route contract', () => {
  const source = readWeb('components/maintenance/execution-form.tsx');

  it('E1: emits the canonical work-order and request detail routes', () => {
    expect(source).toContain('api.get(`/maintenance-work-orders/${sourceId}`)');
    expect(source).toContain('api.get(`/maintenance/requests/${sourceId}`)');
  });

  it('E2: interpolates the selected sourceId into each route', () => {
    expect(source).toMatch(/api\.get\(`\/maintenance-work-orders\/\$\{sourceId\}`\)/);
    expect(source).toMatch(/api\.get\(`\/maintenance\/requests\/\$\{sourceId\}`\)/);
  });

  it('E3: uses no computed/ternary endpoint prefix and no malformed separator', () => {
    expect(source).not.toContain('const endpoint =');
    expect(source).not.toContain('${endpoint}/');
    expect(source).not.toMatch(/api\.get\(`\$\{/);
  });

  it('E4: the detail call is a bare path (no query string serialization)', () => {
    expect(source).not.toMatch(/api\.get\(`\/maintenance-(?:work-orders|requests)\/\$\{[^}]+\}\?/);
  });

  it('E6/E9: the detail call is a read-only GET (no accidental write from normalization)', () => {
    const woGet = source.match(/api\.get\(`\/maintenance-work-orders\/\$\{sourceId\}`\)/g) ?? [];
    const reqGet = source.match(/api\.get\(`\/maintenance\/requests\/\$\{sourceId\}`\)/g) ?? [];
    expect(woGet).toHaveLength(1);
    expect(reqGet).toHaveLength(1);
    expect(source).not.toMatch(/api\.(?:post|patch|put|delete)\(`\/maintenance-(?:work-orders|requests)\/\$\{sourceId\}`\)/);
  });

  it('E7: preserves the execution permission surface (no authorization broadening)', () => {
    expect(source).toContain("permissions?.permissions.includes('maintenance-task:registerHistorical')");
    expect(source).toContain("permissions?.permissions.includes('maintenance-task:parts.issue')");
    expect(source).toContain("permissions?.permissions.includes('maintenance-task:downtime.close')");
  });

  it('E8: issues exactly one detail GET call site per mutually-exclusive branch', () => {
    const matches = source.match(/api\.get\(`\/maintenance(?:-work-orders|\/requests)\/\$\{sourceId\}`\)/g) ?? [];
    expect(matches).toHaveLength(2);
  });
});

describe('maintenance requests create route contract', () => {
  const source = readWeb('app/admin/maintenance/requests/page.tsx');

  it('R1/R2: emits the canonical POST routes with the correct method', () => {
    expect(source).toContain("api.post('/maintenance/requests', payload)");
    expect(source).toContain("api.post('/maintenance/requests/emergency', payload)");
  });

  it('R4: no ternary/legacy unresolved path remains', () => {
    expect(source).not.toContain("form.type === 'EMERGENCY' ?");
    expect(source).not.toMatch(/api\.post\([^)]*\?[^)]*:/);
  });

  it('R3/R6: still patches and deletes the record by id with the same payload', () => {
    expect(source).toContain('api.patch(`/maintenance/requests/${editItem.id}`, payload)');
    expect(source).toContain('api.patch(`/maintenance/requests/${selectedId}/');
  });

  it('R8: relies on the shared api client only (no raw fetch / hand-rolled context headers)', () => {
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/x-active-company-id|x-active-branch-id/);
  });
});

describe('backend endpoints exist for both contracts (contract authority)', () => {
  it('E5: GET /maintenance-work-orders/:id is declared by its controller', () => {
    const wo = readApi(WORK_ORDERS_CONTROLLER);
    expect(wo).toContain("@Controller({ path: 'maintenance-work-orders', version: '1' })");
    expect(wo).toMatch(/@Get\(':id'\)/);
  });

  it('E5: GET /maintenance/requests/:id is declared by its controller', () => {
    const req = readApi(REQUESTS_CONTROLLER);
    expect(req).toContain("@Controller({ path: 'maintenance/requests', version: '1' })");
    expect(req).toMatch(/@Get\(':id'\)/);
  });

  it('R5: POST /maintenance/requests and /emergency exist with their permissions', () => {
    const req = readApi(REQUESTS_CONTROLLER);
    expect(req).toMatch(/@Post\(\)[\s\S]*?@Permissions\('maintenance-request:create'\)/);
    expect(req).toMatch(/@Post\('emergency'\)[\s\S]*?@Permissions\('maintenance-request:createEmergency'\)/);
  });
});

describe('R7: request page localization is unaffected by the route normalization', () => {
  it.each(['common.successCreated', 'common.successUpdated'])('resolves %s in both locales', (key) => {
    for (const [locale, dictionary] of [['en', en], ['ar', ar]] as const) {
      expect(resolveTranslation(dictionary, locale, key)).not.toBe(TRANSLATION_FALLBACKS[locale]);
    }
  });
});
