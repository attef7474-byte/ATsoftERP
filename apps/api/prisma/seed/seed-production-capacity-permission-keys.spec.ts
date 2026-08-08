import { PRODUCTION_CAPACITY_PERMISSION_KEYS } from './seed-production-capacity-permission-keys';

describe('Phase 1.3 permission keys', () => {
  it('matches the controller contract exactly without delete or generic status permission', () => {
    expect([...PRODUCTION_CAPACITY_PERMISSION_KEYS].sort()).toEqual([
      'production-capacity-standard:approve', 'production-capacity-standard:archive',
      'production-capacity-standard:create', 'production-capacity-standard:reactivate',
      'production-capacity-standard:read', 'production-capacity-standard:resolve',
      'production-capacity-standard:suspend', 'production-capacity-standard:update',
    ].sort());
  });
});
