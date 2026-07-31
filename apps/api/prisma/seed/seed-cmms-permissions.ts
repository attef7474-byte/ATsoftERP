import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { CMMS_EXTRA_PERMISSIONS } from "./seed-cmms-permission-keys";
import { syncPermissionKeys } from "./permission-sync";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await syncPermissionKeys(prisma, CMMS_EXTRA_PERMISSIONS);

  const role = await prisma.role.findUniqueOrThrow({ where: { code: "SUPER_ADMIN" } });
  const allPermissions = await prisma.permission.findMany();

  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
      update: {},
      create: { roleId: role.id, permissionId: perm.id },
    });
  }

  console.log(`CMMS permissions seed completed. Added ${result.added} new permissions, migrated ${result.migrated} keys.`);
  for (const detail of result.migrationDetails) {
    console.log(`  - ${detail.oldKey} -> ${detail.newKey} (${detail.reassignedRoles} role(s) reassigned)`);
  }
  console.log(`Total permissions linked to SUPER_ADMIN: ${allPermissions.length}`);
}

main()
  .catch((e) => {
    console.error("CMMS permissions seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
