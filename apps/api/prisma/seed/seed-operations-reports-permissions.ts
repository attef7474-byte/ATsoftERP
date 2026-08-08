import { config } from 'dotenv';
config({ path: '.env' });

import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { syncPermissionKeys } from './permission-sync';
import { OPERATIONS_REPORT_PERMISSIONS } from './seed-operations-reports-permission-keys';

export const OPERATIONS_REPORT_SEED_PERMISSIONS = OPERATIONS_REPORT_PERMISSIONS;

async function main(prisma: PrismaClient) {
  const result = await syncPermissionKeys(prisma, OPERATIONS_REPORT_SEED_PERMISSIONS);
  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'SUPER_ADMIN' } });
  const allPermissions = await prisma.permission.findMany();

  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }

  console.log(`Operations report permissions seed completed. Added ${result.added} new permissions, migrated ${result.migrated} keys.`);
  console.log(`Total permissions linked to SUPER_ADMIN: ${allPermissions.length}`);
}

if (require.main === module) {
  const adapter = new PrismaMssql(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });
  main(prisma)
    .catch((error) => {
      console.error('Operations report permissions seed failed:', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
