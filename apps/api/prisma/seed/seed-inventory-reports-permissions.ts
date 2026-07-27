import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const REPORT_PERMISSIONS: { key: string; module: string; action: string }[] = [
  { key: "inventory:reports:read", module: "inventory", action: "reports-read" },
  { key: "inventory:reports:balances", module: "inventory", action: "reports-balances" },
  { key: "inventory:reports:stock-card", module: "inventory", action: "reports-stock-card" },
  { key: "inventory:reports:movements", module: "inventory", action: "reports-movements" },
  { key: "inventory:reports:traceability", module: "inventory", action: "reports-traceability" },
  { key: "inventory:reports:exceptions", module: "inventory", action: "reports-exceptions" },
  { key: "inventory:reports:export", module: "inventory", action: "reports-export" },
  { key: "inventory:reports:dashboard-cards", module: "inventory", action: "reports-dashboard" },
  { key: "inventory:reports:movement-types", module: "inventory", action: "reports-movement-types" },
  { key: "inventory:reports:by-warehouse", module: "inventory", action: "reports-by-warehouse" },
  { key: "inventory:reports:by-location", module: "inventory", action: "reports-by-location" },
  { key: "inventory:reports:by-product", module: "inventory", action: "reports-by-product" },
  { key: "inventory:reports:negative-balances", module: "inventory", action: "reports-negative-balances" },
  { key: "inventory:reports:reconciliation-differences", module: "inventory", action: "reports-reconciliation-differences" },
  { key: "inventory:reports:top-moving-items", module: "inventory", action: "reports-top-moving" },
];

async function main() {
  let addedCount = 0;
  for (const p of REPORT_PERMISSIONS) {
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
  console.log(`Inventory reports permissions seed completed. Added ${addedCount} new permissions.`);
  console.log(`Total permissions linked to SUPER_ADMIN: ${allPermissions.length}`);
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
