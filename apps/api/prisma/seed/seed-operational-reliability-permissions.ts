import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { OPERATIONAL_RELIABILITY_PERMISSIONS } from "./seed-operational-reliability-permission-keys";
import { syncPermissionKeys } from "./permission-sync";

export const OPERATIONAL_RELIABILITY_SEED_PERMISSIONS = OPERATIONAL_RELIABILITY_PERMISSIONS;

async function main(prisma: PrismaClient) {
  const result = await syncPermissionKeys(prisma, OPERATIONAL_RELIABILITY_SEED_PERMISSIONS);

  const role = await prisma.role.findUniqueOrThrow({ where: { code: "SUPER_ADMIN" } });
  const allPermissions = await prisma.permission.findMany();

  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
      update: {},
      create: { roleId: role.id, permissionId: perm.id },
    });
  }

  console.log(`Operational reliability permissions seed completed. Added ${result.added} new permissions, migrated ${result.migrated} keys.`);
  console.log(`Total permissions linked to SUPER_ADMIN: ${allPermissions.length}`);
}

if (require.main === module) {
  const adapter = new PrismaMssql(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });
  main(prisma)
    .catch((e) => {
      console.error("Operational reliability permissions seed failed:", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
