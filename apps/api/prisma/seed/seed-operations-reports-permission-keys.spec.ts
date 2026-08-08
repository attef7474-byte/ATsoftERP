import { OPERATIONS_REPORT_PERMISSION_KEYS } from '../../src/modules/reports/operations-reports.constants';
import { OPERATIONS_REPORT_PERMISSIONS } from './seed-operations-reports-permission-keys';

describe('Phase 2 Batch 2D operations report permission keys', () => {
  it('contains exactly the controller-enforced read and export keys', () => {
    expect(OPERATIONS_REPORT_PERMISSIONS.map((permission) => permission.key).sort()).toEqual(
      [OPERATIONS_REPORT_PERMISSION_KEYS.read, OPERATIONS_REPORT_PERMISSION_KEYS.export].sort(),
    );
    expect(new Set(OPERATIONS_REPORT_PERMISSIONS.map((permission) => permission.key)).size).toBe(2);
  });

  it('uses the reports.operations module and valid actions', () => {
    for (const permission of OPERATIONS_REPORT_PERMISSIONS) {
      expect(permission.module).toBe('reports.operations');
      expect(permission.action).toMatch(/^(read|export)$/);
    }
  });
});
