import { COST_CENTER_PERMISSION_KEYS } from '../../src/modules/factory/maintenance/cost-centers/cost-centers.constants';

export const OPERATIONAL_COST_CENTER_PERMISSION_KEYS = [
  COST_CENTER_PERMISSION_KEYS.create,
  COST_CENTER_PERMISSION_KEYS.read,
  COST_CENTER_PERMISSION_KEYS.update,
  COST_CENTER_PERMISSION_KEYS.delete,
  COST_CENTER_PERMISSION_KEYS.activate,
  COST_CENTER_PERMISSION_KEYS.deactivate,
  COST_CENTER_PERMISSION_KEYS.assign,
] as const;

export const OPERATIONAL_COST_CENTER_PERMISSIONS = OPERATIONAL_COST_CENTER_PERMISSION_KEYS.map((key) => ({
  key,
  module: key.split(':')[0],
  action: key.split(':')[1],
}));
