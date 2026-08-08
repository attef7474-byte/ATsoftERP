import { PRODUCTION_ORDER_PERMISSION_KEYS } from './seed-production-order-permission-keys';

describe('Phase 1.4 permission keys', () => {
  it('matches the controller workflow contract without later-phase actions', () => {
    expect([...PRODUCTION_ORDER_PERMISSION_KEYS].sort()).toEqual([
      'production-order:archive', 'production-order:attach', 'production-order:cancel',
      'production-order:close', 'production-order:create', 'production-order:delete',
      'production-order:plan', 'production-order:read', 'production-order:readiness',
      'production-order:recalculate', 'production-order:release', 'production-order:reopen',
      'production-order:update',
    ].sort());
    expect(PRODUCTION_ORDER_PERMISSION_KEYS.some((key) => /start|complete|post/i.test(key))).toBe(false);
  });
});
