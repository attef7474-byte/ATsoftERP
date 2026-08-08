import { OPERATIONS_REPORT_PERMISSION_KEYS_LIST } from '../../src/modules/reports/operations-reports.constants';

export const OPERATIONS_REPORT_PERMISSIONS = OPERATIONS_REPORT_PERMISSION_KEYS_LIST.map((key) => ({
  key,
  module: key.split(':')[0],
  action: key.split(':')[1],
}));
