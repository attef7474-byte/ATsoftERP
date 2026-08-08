import { GUARDS_METADATA } from '@nestjs/common/constants';
import { OperationsReportsController } from './operations-reports.controller';
import { OPERATIONS_REPORT_PERMISSION_KEYS } from './operations-reports.constants';

describe('OperationsReportsController permission contract', () => {
  const controller = new OperationsReportsController({} as any);
  const permissions = (method: 'overview' | 'drilldown' | 'export') => Reflect.getMetadata('permissions', controller[method]);

  it('requires reports.operations:read for overview and drilldown', () => {
    expect(permissions('overview')).toEqual([OPERATIONS_REPORT_PERMISSION_KEYS.read]);
    expect(permissions('drilldown')).toEqual([OPERATIONS_REPORT_PERMISSION_KEYS.read]);
  });

  it('requires the distinct export permission', () => {
    expect(permissions('export')).toEqual([OPERATIONS_REPORT_PERMISSION_KEYS.export]);
  });

  it('is protected by authentication and permission guards', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, OperationsReportsController) ?? [];
    expect(guards.map((guard: any) => guard.name)).toEqual(expect.arrayContaining(['JwtAuthGuard', 'PermissionsGuard']));
  });
});
