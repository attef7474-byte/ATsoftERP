export const OVERHEAD_ALLOCATION_PERMISSION_KEYS = {
  read: 'production-cost-overhead-allocation:read',
  create: 'production-cost-overhead-allocation:create',
  update: 'production-cost-overhead-allocation:update',
  calculate: 'production-cost-overhead-allocation:calculate',
  finalize: 'production-cost-overhead-allocation:finalize',
  post: 'production-cost-overhead-allocation:post',
  reconcile: 'production-cost-overhead-allocation:reconcile',
} as const;
export const OVERHEAD_ALLOCATION_PERMISSIONS = Object.values(OVERHEAD_ALLOCATION_PERMISSION_KEYS).map(key => ({
  key, module: key.split(':')[0], action: key.split(':')[1],
}));
