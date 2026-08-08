import { CMMS_EXTRA_PERMISSIONS } from './seed-cmms-permission-keys';

describe('CMMS permission keys', () => {
  const seededKeys = new Set(CMMS_EXTRA_PERMISSIONS.map((p) => p.key));

  it('seeds every permission key enforced by downtime-logs.controller.ts', () => {
    const controllerKeys = [
      'downtime-log:create',
      'downtime-log:read',
      'downtime-log:update',
      'downtime-log:delete',
      'downtime-log:close',
      'downtime-log:cancel',
      'downtime-log:start',
      'downtime-log:end',
      'downtime-log:current.view',
      'downtime-log:analysis.view',
      'downtime-log:byMachine.view',
      'downtime-log:classify',
    ];
    for (const key of controllerKeys) {
      expect(seededKeys.has(key)).toBe(true);
    }
  });

  it('has no duplicate permission keys', () => {
    expect(seededKeys.size).toBe(CMMS_EXTRA_PERMISSIONS.length);
  });

  it('derives module and action from each key', () => {
    for (const p of CMMS_EXTRA_PERMISSIONS) {
      const separator = p.key.lastIndexOf(':');
      expect(p.module).toBe(p.key.slice(0, separator));
      expect(p.action).toBe(p.key.slice(separator + 1));
    }
  });
});
