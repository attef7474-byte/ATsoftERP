import { api } from './api';
import { unwrapApiList } from './form-utils';
import { InventoryValuationPolicy } from './admin-types';

export const VALUATION_COST_INPUT_PERMISSION = 'inventory-valuation:cost-input';

export async function fetchActiveValuationPolicy(
  warehouseId: string,
): Promise<InventoryValuationPolicy | null> {
  if (!warehouseId) return null;
  const res = await api.get<{ data: InventoryValuationPolicy[]; meta: any }>(
    '/inventory-valuation/policies',
    { params: { warehouseId, status: 'ACTIVE', limit: 10 } },
  );
  const list = unwrapApiList<InventoryValuationPolicy, any>(res);
  return list.data[0] || null;
}

export function hasValuationCostInputPermission(
  permissions: string[] | null | undefined,
  isSuperAdmin = false,
): boolean {
  return isSuperAdmin || (Array.isArray(permissions) && permissions.includes(VALUATION_COST_INPUT_PERMISSION));
}
