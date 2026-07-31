import { CMMS_EXTRA_PERMISSIONS } from '../../../../prisma/seed/seed-cmms-permission-keys';
import * as InstalledPartsReplacementController from './installed-parts-replacement/installed-parts-replacement.controller';
import * as MaintenanceRequestsController from './maintenance-requests/maintenance-requests.controller';

describe('Maintenance permission seed consistency', () => {
  const seedKeys = CMMS_EXTRA_PERMISSIONS.map((p) => p.key);
  const genericCrudActions = new Set(['create', 'read', 'update', 'delete']);

  const collectEnforcedKeys = (controllerModule: Record<string, unknown>): string[] => {
    const keys: string[] = [];
    for (const exported of Object.values(controllerModule)) {
      if (typeof exported !== 'function') continue;
      const classMeta = Reflect.getMetadata('permissions', exported);
      if (Array.isArray(classMeta)) keys.push(...classMeta);
      for (const methodName of Object.getOwnPropertyNames(exported.prototype)) {
        if (methodName === 'constructor') continue;
        const methodMeta = Reflect.getMetadata('permissions', exported.prototype[methodName]);
        if (Array.isArray(methodMeta)) keys.push(...methodMeta);
      }
    }
    return keys;
  };

  const missingFromExtraSeed = (enforced: string[]) =>
    enforced.filter((key) => !seedKeys.includes(key) && !genericCrudActions.has(key.split(':')[1]));

  it('seeds every permission key enforced by the installed-parts controller', () => {
    const enforced = collectEnforcedKeys(InstalledPartsReplacementController);
    expect(enforced.length).toBeGreaterThan(0);
    expect(missingFromExtraSeed(enforced)).toEqual([]);
    expect(seedKeys).toContain('installed-parts:read');
  });

  it('seeds every non-generic permission key enforced by the maintenance-requests controller', () => {
    const enforced = collectEnforcedKeys(MaintenanceRequestsController);
    expect(missingFromExtraSeed(enforced)).toEqual([]);
  });

  it('seeds the canonical activity.view, attachments.view and print keys', () => {
    expect(seedKeys).toContain('maintenance-request:activity.view');
    expect(seedKeys).toContain('maintenance-request:attachments.view');
    expect(seedKeys).toContain('maintenance-request:print');
  });

  it('does not seed the obsolete maintenance-request key variants', () => {
    expect(seedKeys).not.toContain('maintenance-request:activity');
    expect(seedKeys).not.toContain('maintenance-request:attachments');
    expect(seedKeys).not.toContain('maintenance-request:printData');
  });

  it('keeps exactly one canonical key per permission action (no duplicate aliases)', () => {
    const duplicates = seedKeys.filter((key, index) => seedKeys.indexOf(key) !== index);
    expect(duplicates).toEqual([]);
  });
});
