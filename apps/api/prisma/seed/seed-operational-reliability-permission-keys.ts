import { OPERATIONAL_RELIABILITY_PERMISSION_KEYS } from '../../src/modules/factory/operational-analytics/reliability/operational-reliability.constants';

export const OPERATIONAL_RELIABILITY_PERMISSIONS = [
  OPERATIONAL_RELIABILITY_PERMISSION_KEYS.read,
  OPERATIONAL_RELIABILITY_PERMISSION_KEYS.export,
].map((key) => ({
  key,
  module: key.split(':')[0],
  action: key.split(':')[1],
}));
