import 'reflect-metadata';
import { OperationalReliabilityController } from './operational-reliability.controller';
import { OPERATIONAL_RELIABILITY_PERMISSION_KEYS } from './operational-reliability.constants';

describe('OperationalReliabilityController (permission gating)', () => {
  const controller = new OperationalReliabilityController({} as any);

  const routePermissions = (methodName: string): string[] =>
    Reflect.getMetadata('permissions', controller[methodName as keyof OperationalReliabilityController]);

  it('gates the reliability summary with operational-reliability:read', () => {
    expect(routePermissions('summary')).toEqual([OPERATIONAL_RELIABILITY_PERMISSION_KEYS.read]);
  });

  it('gates the reliability drilldown with operational-reliability:read', () => {
    expect(routePermissions('drilldown')).toEqual([OPERATIONAL_RELIABILITY_PERMISSION_KEYS.read]);
  });

  it('gates the export with operational-reliability:export', () => {
    expect(routePermissions('export')).toEqual([OPERATIONAL_RELIABILITY_PERMISSION_KEYS.export]);
  });

  it('exposes exactly the two frozen 2C keys (no classify/approve, D-2C-4)', () => {
    const enforced = new Set(
      ['summary', 'drilldown', 'export'].flatMap((m) => routePermissions(m)),
    );
    expect(enforced).toEqual(
      new Set([OPERATIONAL_RELIABILITY_PERMISSION_KEYS.read, OPERATIONAL_RELIABILITY_PERMISSION_KEYS.export]),
    );
  });
});
