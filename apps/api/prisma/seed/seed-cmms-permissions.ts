import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const EXTRA_PERMISSIONS: { key: string; module: string; action: string }[] = [
  // machine-category
  { key: "machine-category:activate", module: "machine-category", action: "activate" },
  { key: "machine-category:deactivate", module: "machine-category", action: "deactivate" },
  // machine-part
  { key: "machine-part:activate", module: "machine-part", action: "activate" },
  { key: "machine-part:deactivate", module: "machine-part", action: "deactivate" },
  // machine-document (new module, all actions)
  { key: "machine-document:create", module: "machine-document", action: "create" },
  { key: "machine-document:read", module: "machine-document", action: "read" },
  { key: "machine-document:update", module: "machine-document", action: "update" },
  { key: "machine-document:deactivate", module: "machine-document", action: "deactivate" },
  // maintenance-request
  { key: "maintenance-request:start", module: "maintenance-request", action: "start" },
  { key: "maintenance-request:complete", module: "maintenance-request", action: "complete" },
  { key: "maintenance-request:cancel", module: "maintenance-request", action: "cancel" },
  // maintenance-task
  { key: "maintenance-task:start", module: "maintenance-task", action: "start" },
  { key: "maintenance-task:complete", module: "maintenance-task", action: "complete" },
  { key: "maintenance-task:cancel", module: "maintenance-task", action: "cancel" },
  // maintenance-schedule
  { key: "maintenance-schedule:activate", module: "maintenance-schedule", action: "activate" },
  { key: "maintenance-schedule:deactivate", module: "maintenance-schedule", action: "deactivate" },
  // maintenance-checklist
  { key: "maintenance-checklist:activate", module: "maintenance-checklist", action: "activate" },
  { key: "maintenance-checklist:deactivate", module: "maintenance-checklist", action: "deactivate" },
  // downtime-log (new module, all actions)
  { key: "downtime-log:create", module: "downtime-log", action: "create" },
  { key: "downtime-log:read", module: "downtime-log", action: "read" },
  { key: "downtime-log:update", module: "downtime-log", action: "update" },
  { key: "downtime-log:delete", module: "downtime-log", action: "delete" },
  { key: "downtime-log:close", module: "downtime-log", action: "close" },
  { key: "downtime-log:cancel", module: "downtime-log", action: "cancel" },
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

  console.log(`CMMS permissions seed completed. Added ${addedCount} new permissions.`);
  console.log(`Total permissions linked to SUPER_ADMIN: ${allPermissions.length}`);
}

main()
  .catch((e) => {
    console.error("CMMS permissions seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
