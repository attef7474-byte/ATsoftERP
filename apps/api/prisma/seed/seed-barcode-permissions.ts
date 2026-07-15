import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const EXTRA_PERMISSIONS: { key: string; module: string; action: string }[] = [
  { key: "barcode-label:create", module: "barcode-label", action: "create" },
  { key: "barcode-label:read", module: "barcode-label", action: "read" },
  { key: "barcode-label:update", module: "barcode-label", action: "update" },
  { key: "barcode-label:delete", module: "barcode-label", action: "delete" },
  { key: "barcode-label:activate", module: "barcode-label", action: "activate" },
  { key: "barcode-label:deactivate", module: "barcode-label", action: "deactivate" },
  { key: "barcode-label:retire", module: "barcode-label", action: "retire" },
  { key: "barcode-label:void", module: "barcode-label", action: "void" },
  { key: "barcode-label:print", module: "barcode-label", action: "print" },
  { key: "barcode-label:resolve", module: "barcode-label", action: "resolve" },
  { key: "barcode-scan:create", module: "barcode-scan", action: "create" },
  { key: "barcode-scan:read", module: "barcode-scan", action: "read" },
  { key: "barcode-scan:resolve", module: "barcode-scan", action: "resolve" },
  { key: "barcode-scan:inventory-count", module: "barcode-scan", action: "inventory-count" },
  { key: "barcode-scan:maintenance", module: "barcode-scan", action: "maintenance" },
  { key: "barcode-scan:machine-check", module: "barcode-scan", action: "machine-check" },
  { key: "barcode-scan:part-lookup", module: "barcode-scan", action: "part-lookup" },
  { key: "barcode-template:create", module: "barcode-template", action: "create" },
  { key: "barcode-template:read", module: "barcode-template", action: "read" },
  { key: "barcode-template:update", module: "barcode-template", action: "update" },
  { key: "barcode-template:delete", module: "barcode-template", action: "delete" },
  { key: "barcode-template:activate", module: "barcode-template", action: "activate" },
  { key: "barcode-template:deactivate", module: "barcode-template", action: "deactivate" },
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

  console.log(`Barcode permissions seed completed. Added ${addedCount} new permissions.`);
  console.log(`Total permissions linked to SUPER_ADMIN: ${allPermissions.length}`);
}

main()
  .catch((e) => {
    console.error("Barcode permissions seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
