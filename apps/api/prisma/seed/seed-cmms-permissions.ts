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
  { key: "machine-category:summary", module: "machine-category", action: "summary" },
  { key: "machine-category:machines", module: "machine-category", action: "machines" },
  // machine-part
  { key: "machine-part:activate", module: "machine-part", action: "activate" },
  { key: "machine-part:deactivate", module: "machine-part", action: "deactivate" },
  { key: "machine-part:linkMachine", module: "machine-part", action: "linkMachine" },
  { key: "machine-part:unlinkMachine", module: "machine-part", action: "unlinkMachine" },
  // machine-document (new module, all actions)
  { key: "machine-document:create", module: "machine-document", action: "create" },
  { key: "machine-document:read", module: "machine-document", action: "read" },
  { key: "machine-document:update", module: "machine-document", action: "update" },
  { key: "machine-document:deactivate", module: "machine-document", action: "deactivate" },
  { key: "machine-document:download", module: "machine-document", action: "download" },
  { key: "machine-document:history", module: "machine-document", action: "history" },
  // machine (PATCH/POST/DELETE actions)
  { key: "machine:updateStatus", module: "machine", action: "updateStatus" },
  { key: "machine:updateLocation", module: "machine", action: "updateLocation" },
  { key: "machine:updateManufacturer", module: "machine", action: "updateManufacturer" },
  { key: "machine:updateWarranty", module: "machine", action: "updateWarranty" },
  { key: "machine:updateImage", module: "machine", action: "updateImage" },
  // maintenance-request
  { key: "maintenance-request:start", module: "maintenance-request", action: "start" },
  { key: "maintenance-request:complete", module: "maintenance-request", action: "complete" },
  { key: "maintenance-request:cancel", module: "maintenance-request", action: "cancel" },
  { key: "maintenance-request:assign", module: "maintenance-request", action: "assign" },
  // maintenance-request-part (new module, all actions)
  { key: "maintenance-request-part:create", module: "maintenance-request-part", action: "create" },
  { key: "maintenance-request-part:read", module: "maintenance-request-part", action: "read" },
  { key: "maintenance-request-part:update", module: "maintenance-request-part", action: "update" },
  { key: "maintenance-request-part:delete", module: "maintenance-request-part", action: "delete" },
  // maintenance-request-cost (new module, all actions)
  { key: "maintenance-request-cost:create", module: "maintenance-request-cost", action: "create" },
  { key: "maintenance-request-cost:read", module: "maintenance-request-cost", action: "read" },
  { key: "maintenance-request-cost:update", module: "maintenance-request-cost", action: "update" },
  { key: "maintenance-request-cost:delete", module: "maintenance-request-cost", action: "delete" },
  // maintenance-checklist-execution (new module)
  { key: "maintenance-checklist-execution:create", module: "maintenance-checklist-execution", action: "create" },
  { key: "maintenance-checklist-execution:read", module: "maintenance-checklist-execution", action: "read" },
  { key: "maintenance-checklist-execution:update", module: "maintenance-checklist-execution", action: "update" },
  { key: "maintenance-checklist-execution:complete", module: "maintenance-checklist-execution", action: "complete" },
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
