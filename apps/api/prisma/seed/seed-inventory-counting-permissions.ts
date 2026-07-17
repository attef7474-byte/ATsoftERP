import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const EXTRA_PERMISSIONS: { key: string; module: string; action: string }[] = [
  // inventory-count
  { key: "inventory-count:start", module: "inventory-count", action: "start" },
  { key: "inventory-count:complete", module: "inventory-count", action: "complete" },
  { key: "inventory-count:cancel", module: "inventory-count", action: "cancel" },
  { key: "inventory-count:generateAdjustment", module: "inventory-count", action: "generateAdjustment" },
  // inventory-count-line
  { key: "inventory-count-line:count", module: "inventory-count-line", action: "count" },
  { key: "inventory-count-line:verify", module: "inventory-count-line", action: "verify" },
  // inventory-movement
  { key: "inventory-movement:post", module: "inventory-movement", action: "post" },
  { key: "inventory-movement:cancel", module: "inventory-movement", action: "cancel" },
  // inventory-adjustment
  { key: "inventory-adjustment:post", module: "inventory-adjustment", action: "post" },
  { key: "inventory-adjustment:cancel", module: "inventory-adjustment", action: "cancel" },
  // inventory-balance
  { key: "inventory-balance:recalculate", module: "inventory-balance", action: "recalculate" },
  // warehouse activate/deactivate
  { key: "warehouse:activate", module: "warehouse", action: "activate" },
  { key: "warehouse:deactivate", module: "warehouse", action: "deactivate" },
  // location activate/deactivate
  { key: "warehouse-location:activate", module: "warehouse-location", action: "activate" },
  { key: "warehouse-location:deactivate", module: "warehouse-location", action: "deactivate" },
  // product activate/deactivate
  { key: "product:activate", module: "product", action: "activate" },
  { key: "product:deactivate", module: "product", action: "deactivate" },
  // product-category activate/deactivate
  { key: "product-category:activate", module: "product-category", action: "activate" },
  { key: "product-category:deactivate", module: "product-category", action: "deactivate" },
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

  console.log(`Inventory counting permissions seed completed. Added ${addedCount} new permissions.`);
  console.log(`Total permissions linked to SUPER_ADMIN: ${allPermissions.length}`);
}

main()
  .catch((e) => {
    console.error("Inventory counting permissions seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
