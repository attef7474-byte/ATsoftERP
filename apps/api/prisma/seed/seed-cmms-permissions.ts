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
  // maintenance-dashboard (Batch 31)
  { key: "maintenance-dashboard:summary", module: "maintenance-dashboard", action: "summary" },
  { key: "maintenance-dashboard:openRequests", module: "maintenance-dashboard", action: "openRequests" },
  { key: "maintenance-dashboard:overdueTasks", module: "maintenance-dashboard", action: "overdueTasks" },
  { key: "maintenance-dashboard:upcomingPM", module: "maintenance-dashboard", action: "upcomingPM" },
  { key: "maintenance-dashboard:currentDowntime", module: "maintenance-dashboard", action: "currentDowntime" },
  { key: "maintenance-dashboard:recentActivity", module: "maintenance-dashboard", action: "recentActivity" },
  { key: "maintenance-dashboard:costSummary", module: "maintenance-dashboard", action: "costSummary" },
  { key: "maintenance-dashboard:partsUsage", module: "maintenance-dashboard", action: "partsUsage" },
  // maintenance-request extensions (Batch 31)
  { key: "maintenance-request:reopen", module: "maintenance-request", action: "reopen" },
  { key: "maintenance-request:workflow", module: "maintenance-request", action: "workflow" },
  { key: "maintenance-request:activity", module: "maintenance-request", action: "activity" },
  { key: "maintenance-request:attachments", module: "maintenance-request", action: "attachments" },
  { key: "maintenance-request:printData", module: "maintenance-request", action: "printData" },
  { key: "maintenance-request:checklist", module: "maintenance-request", action: "checklist" },
  { key: "maintenance-request:createChecklist", module: "maintenance-request", action: "createChecklist" },
  { key: "maintenance-request:summary", module: "maintenance-request", action: "summary" },
  // maintenance-request-required-part (Batch F)
  { key: "maintenance-request-required-part:read", module: "maintenance-request-required-part", action: "read" },
  { key: "maintenance-request-required-part:create", module: "maintenance-request-required-part", action: "create" },
  { key: "maintenance-request-required-part:update", module: "maintenance-request-required-part", action: "update" },
  { key: "maintenance-request-required-part:cancel", module: "maintenance-request-required-part", action: "cancel" },
  // maintenance-task extensions (Batch 31)
  { key: "maintenance-task:assign", module: "maintenance-task", action: "assign" },
  { key: "maintenance-task:myTasks", module: "maintenance-task", action: "myTasks" },
  { key: "maintenance-task:byRequest", module: "maintenance-task", action: "byRequest" },
  { key: "maintenance-task:overdue", module: "maintenance-task", action: "overdue" },
  // maintenance-schedule extensions (Batch 31)
  { key: "maintenance-schedule:execute", module: "maintenance-schedule", action: "execute" },
  { key: "maintenance-schedule:history", module: "maintenance-schedule", action: "history" },
  // preventive-maintenance (Batch 31)
  { key: "preventive-maintenance:upcoming", module: "preventive-maintenance", action: "upcoming" },
  { key: "preventive-maintenance:overdue", module: "preventive-maintenance", action: "overdue" },
  { key: "preventive-maintenance:calendar", module: "preventive-maintenance", action: "calendar" },
  { key: "preventive-maintenance:executionHistory", module: "preventive-maintenance", action: "executionHistory" },
  { key: "preventive-maintenance:generateDueTasks", module: "preventive-maintenance", action: "generateDueTasks" },
  // downtime-log extensions (Batch 31)
  { key: "downtime-log:startDowntime", module: "downtime-log", action: "startDowntime" },
  { key: "downtime-log:endDowntime", module: "downtime-log", action: "endDowntime" },
  { key: "downtime-log:classify", module: "downtime-log", action: "classify" },
  { key: "downtime-log:current", module: "downtime-log", action: "current" },
  { key: "downtime-log:analysis", module: "downtime-log", action: "analysis" },
  { key: "downtime-log:byMachine", module: "downtime-log", action: "byMachine" },
  { key: "downtime-log:logSummary", module: "downtime-log", action: "logSummary" },
  // machine-component (new module, all actions)
  { key: "machine-component:create", module: "machine-component", action: "create" },
  { key: "machine-component:read", module: "machine-component", action: "read" },
  { key: "machine-component:update", module: "machine-component", action: "update" },
  { key: "machine-component:delete", module: "machine-component", action: "delete" },
  { key: "machine-component:activate", module: "machine-component", action: "activate" },
  { key: "machine-component:deactivate", module: "machine-component", action: "deactivate" },
  // spare-part (new module, all actions)
  { key: "spare-part:create", module: "spare-part", action: "create" },
  { key: "spare-part:read", module: "spare-part", action: "read" },
  { key: "spare-part:update", module: "spare-part", action: "update" },
  { key: "spare-part:delete", module: "spare-part", action: "delete" },
  { key: "spare-part:activate", module: "spare-part", action: "activate" },
  { key: "spare-part:deactivate", module: "spare-part", action: "deactivate" },
  // component-spare-part (new module, all actions)
  { key: "component-spare-part:create", module: "component-spare-part", action: "create" },
  { key: "component-spare-part:read", module: "component-spare-part", action: "read" },
  { key: "component-spare-part:update", module: "component-spare-part", action: "update" },
  { key: "component-spare-part:deactivate", module: "component-spare-part", action: "deactivate" },
  // machine-spare-part (new module, all actions)
  { key: "machine-spare-part:create", module: "machine-spare-part", action: "create" },
  { key: "machine-spare-part:read", module: "machine-spare-part", action: "read" },
  { key: "machine-spare-part:update", module: "machine-spare-part", action: "update" },
  { key: "machine-spare-part:deactivate", module: "machine-spare-part", action: "deactivate" },
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
