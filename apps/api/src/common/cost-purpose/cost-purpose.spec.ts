import { ForbiddenException } from '@nestjs/common';
import {
  COST_PURPOSE_VALUES,
  MAINTENANCE_COST_PURPOSE,
  PRODUCTION_COST_PURPOSE,
  COST_PURPOSE_OVERRIDE_PERMISSION,
  isCostPurpose,
} from './cost-purpose.constants';
import { userCanOverrideCostPurpose, assertCostPurposeOverrideAllowed } from './cost-purpose-permission';

function roleRow(code: string, permissions: Array<string>, active = true) {
  return {
    role: {
      status: active ? 'ACTIVE' : 'INACTIVE',
      code,
      permissions: permissions.map((key) => ({ permission: { status: 'ACTIVE', key } })),
    },
  };
}

describe('cost-purpose.constants', () => {
  it('exports the canonical 8-value cost purpose set with the two workflow defaults', () => {
    expect(COST_PURPOSE_VALUES).toEqual([
      'MAINTENANCE',
      'PRODUCTION',
      'QUALITY',
      'PROJECT',
      'UTILITIES',
      'ADMIN',
      'DEVELOPMENT',
      'OTHER',
    ]);
    expect(MAINTENANCE_COST_PURPOSE).toBe('MAINTENANCE');
    expect(PRODUCTION_COST_PURPOSE).toBe('PRODUCTION');
    expect(COST_PURPOSE_OVERRIDE_PERMISSION).toBe('cost-purpose:override');
  });

  it('rejects null, empty and out-of-set values with isCostPurpose', () => {
    expect(isCostPurpose(null)).toBe(false);
    expect(isCostPurpose(undefined)).toBe(false);
    expect(isCostPurpose('')).toBe(false);
    expect(isCostPurpose('SALES')).toBe(false);
    expect(isCostPurpose('MAINTENANCE')).toBe(true);
    expect(isCostPurpose('PRODUCTION')).toBe(true);
    expect(isCostPurpose('OTHER')).toBe(true);
  });
});

describe('cost-purpose.permission', () => {
  const prisma: any = { userRole: { findMany: jest.fn() } };

  beforeEach(() => {
    prisma.userRole.findMany.mockReset();
  });

  it('returns false when the user holds no roles / has no override permission', async () => {
    prisma.userRole.findMany.mockResolvedValue([]);
    await expect(userCanOverrideCostPurpose(prisma, 'u1')).resolves.toBe(false);
  });

  it('returns false when the only matching role is inactive', async () => {
    prisma.userRole.findMany.mockResolvedValue([roleRow('COST', ['cost-purpose:override'], false)]);
    await expect(userCanOverrideCostPurpose(prisma, 'u1')).resolves.toBe(false);
  });

  it('returns true for SUPER_ADMIN roles even without the explicit permission', async () => {
    prisma.userRole.findMany.mockResolvedValue([roleRow('SUPER_ADMIN', [])]);
    await expect(userCanOverrideCostPurpose(prisma, 'u1')).resolves.toBe(true);
  });

  it('returns true when an active role holds the canonical cost-purpose:override permission', async () => {
    prisma.userRole.findMany.mockResolvedValue([roleRow('COST', ['cost-purpose:override'])]);
    await expect(userCanOverrideCostPurpose(prisma, 'u1')).resolves.toBe(true);
  });

  it('returns false when no userId is provided', async () => {
    await expect(userCanOverrideCostPurpose(prisma, undefined)).resolves.toBe(false);
    expect(prisma.userRole.findMany).not.toHaveBeenCalled();
  });

  it('assertCostPurposeOverrideAllowed throws ForbiddenException when denied', async () => {
    prisma.userRole.findMany.mockResolvedValue([]);
    await expect(assertCostPurposeOverrideAllowed(prisma, 'u1')).rejects.toThrow(ForbiddenException);
  });

  it('assertCostPurposeOverrideAllowed resolves when the override permission is held', async () => {
    prisma.userRole.findMany.mockResolvedValue([roleRow('COST', ['cost-purpose:override'])]);
    await expect(assertCostPurposeOverrideAllowed(prisma, 'u1')).resolves.toBeUndefined();
  });
});
