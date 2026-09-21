import { PrismaClient } from '@prisma/client';
import { OVERHEAD_ALLOCATION_PERMISSIONS } from './seed-overhead-allocation-permission-keys';

/** Only B2 permission definitions and an existing SUPER_ADMIN role are touched. */
export async function seedOverheadAllocationPermissions(prisma: PrismaClient) {
  return prisma.$transaction(async tx => {
    const role = await tx.role.findFirst({ where: { code: 'SUPER_ADMIN', status: 'ACTIVE' } });
    for (const permission of OVERHEAD_ALLOCATION_PERMISSIONS) {
      const row = await tx.permission.upsert({ where: { key: permission.key }, update: { ...permission, status: 'ACTIVE' }, create: { ...permission, status: 'ACTIVE' } });
      if (role) await tx.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: row.id } }, update: {}, create: { roleId: role.id, permissionId: row.id } });
    }
    return { permissionCount: OVERHEAD_ALLOCATION_PERMISSIONS.length, existingSuperAdminAssigned: Boolean(role) };
  });
}
