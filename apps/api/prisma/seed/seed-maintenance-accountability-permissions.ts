import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const EXTRA_PERMISSIONS: { key: string; module: string; action: string }[] = [
  // maintenance-personnel (full CRUD + activate/deactivate)
  { key: "maintenance-personnel:create", module: "maintenance-personnel", action: "create" },
  { key: "maintenance-personnel:read", module: "maintenance-personnel", action: "read" },
  { key: "maintenance-personnel:update", module: "maintenance-personnel", action: "update" },
  { key: "maintenance-personnel:delete", module: "maintenance-personnel", action: "delete" },
  { key: "maintenance-personnel:activate", module: "maintenance-personnel", action: "activate" },
  { key: "maintenance-personnel:deactivate", module: "maintenance-personnel", action: "deactivate" },
  // machine-responsibility (full CRUD + end/cancel)
  { key: "machine-responsibility:create", module: "machine-responsibility", action: "create" },
  { key: "machine-responsibility:read", module: "machine-responsibility", action: "read" },
  { key: "machine-responsibility:update", module: "machine-responsibility", action: "update" },
  { key: "machine-responsibility:delete", module: "machine-responsibility", action: "delete" },
  { key: "machine-responsibility:end", module: "machine-responsibility", action: "end" },
  { key: "machine-responsibility:cancel", module: "machine-responsibility", action: "cancel" },
  // maintenance-request-assignment (CRUD + lifecycle actions)
  { key: "maintenance-request-assignment:create", module: "maintenance-request-assignment", action: "create" },
  { key: "maintenance-request-assignment:read", module: "maintenance-request-assignment", action: "read" },
  { key: "maintenance-request-assignment:update", module: "maintenance-request-assignment", action: "update" },
  { key: "maintenance-request-assignment:delete", module: "maintenance-request-assignment", action: "delete" },
  { key: "maintenance-request-assignment:accept", module: "maintenance-request-assignment", action: "accept" },
  { key: "maintenance-request-assignment:start", module: "maintenance-request-assignment", action: "start" },
  { key: "maintenance-request-assignment:complete", module: "maintenance-request-assignment", action: "complete" },
  { key: "maintenance-request-assignment:cancel", module: "maintenance-request-assignment", action: "cancel" },
  // maintenance-part-accountability (CRUD + actions)
  { key: "maintenance-part-accountability:create", module: "maintenance-part-accountability", action: "create" },
  { key: "maintenance-part-accountability:read", module: "maintenance-part-accountability", action: "read" },
  { key: "maintenance-part-accountability:update", module: "maintenance-part-accountability", action: "update" },
  { key: "maintenance-part-accountability:delete", module: "maintenance-part-accountability", action: "delete" },
  { key: "maintenance-part-accountability:reportUsed", module: "maintenance-part-accountability", action: "reportUsed" },
  { key: "maintenance-part-accountability:return", module: "maintenance-part-accountability", action: "return" },
  { key: "maintenance-part-accountability:cancel", module: "maintenance-part-accountability", action: "cancel" },
  // maintenance-dashboard accountability reports
  { key: "maintenance-dashboard:accountabilityKpis", module: "maintenance-dashboard", action: "accountabilityKpis" },
];

async function main() {
  let addedCount = 0;

  for (const p of EXTRA_PERMISSIONS) {
    const existing = await prisma.permission.findUnique({ where: { key: p.key } });
    if (!existing) {
      await prisma.permission.create({ data: { key: p.key, module: p.module, action: p.action, status: "ACTIVE" } });
      addedCount++;
    }
  }

  const role = await prisma.role.findUniqueOrThrow({ where: { code: "SUPER_ADMIN" } });
  const allPermissions = await prisma.permission.findMany();

  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
      update: {},
      create: { roleId: role.id, permissionId: perm.id },
    });
  }

  console.log(`Maintenance accountability permissions seed completed. Added ${addedCount} new permissions.`);
  console.log(`Total permissions linked to SUPER_ADMIN: ${allPermissions.length}`);
}

main()
  .catch((e) => {
    console.error("Maintenance accountability permissions seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
