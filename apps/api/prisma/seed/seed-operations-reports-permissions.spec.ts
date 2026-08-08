import { OPERATIONS_REPORT_PERMISSION_KEYS } from '../../src/modules/reports/operations-reports.constants';
import { OPERATIONS_REPORT_PERMISSIONS } from './seed-operations-reports-permission-keys';
import { OPERATIONS_REPORT_SEED_PERMISSIONS } from './seed-operations-reports-permissions';

describe('Operations report standalone permission seed', () => {
  it('registers exactly reports.operations:read and reports.operations:export', () => {
    expect(OPERATIONS_REPORT_SEED_PERMISSIONS).toEqual(OPERATIONS_REPORT_PERMISSIONS);
    expect(OPERATIONS_REPORT_SEED_PERMISSIONS.map((permission) => permission.key).sort()).toEqual(
      [OPERATIONS_REPORT_PERMISSION_KEYS.read, OPERATIONS_REPORT_PERMISSION_KEYS.export].sort(),
    );
  });

  it('importing the runner does not construct a Prisma client or open a database connection', () => {
    jest.isolateModules(() => {
      const prismaClientMock = jest.fn();
      const prismaMssqlMock = jest.fn();
      jest.doMock('@prisma/client', () => ({ PrismaClient: prismaClientMock }));
      jest.doMock('@prisma/adapter-mssql', () => ({ PrismaMssql: prismaMssqlMock }));
      require('./seed-operations-reports-permissions');
      expect(prismaClientMock).not.toHaveBeenCalled();
      expect(prismaMssqlMock).not.toHaveBeenCalled();
    });
  });
});
