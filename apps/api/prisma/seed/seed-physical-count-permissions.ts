import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const PHYSICAL_COUNT_PERMISSIONS: { key: string; module: string; action: string }[] = [
  { key: "inventory:physical-count:create", module: "inventory", action: "create" },
  { key: "inventory:physical-count:read", module: "inventory", action: "read" },
  { key: "inventory:physical-count:update", module: "inventory", action: "update" },
  { key: "inventory:physical-count:delete", module: "inventory", action: "delete" },
  { key: "inventory:physical-count:submit", module: "inventory", action: "submit" },
  { key: "inventory:physical-count:approve", module: "inventory", action: "approve" },
  { key: "inventory:physical-count:reject", module: "inventory", action: "reject" },
  { key: "inventory:physical-count:post", module: "inventory", action: "post" },
  { key: "inventory:physical-count:cancel", module: "inventory", action: "cancel" },
  { key: "inventory:physical-count:enter-line", module: "inventory", action: "enter-line" },
];

async function main() {
  let addedCount = 0;

  for (const p of PHYSICAL_COUNT_PERMISSIONS) {
    const existing = await prisma.permission.findUnique({ where: { key: p.key } });
    if (!existing) {
      await prisma.permission.create({ data: { key: p.key, module: p.module, action: p.action, status: "ACTIVE" } });
      addedCount++;
    }
  }

  // Link all permissions to SUPER_ADMIN role
  const role = await prisma.role.findUniqueOrThrow({ where: { code: "SUPER_ADMIN" } });
  const allPermissions = await prisma.permission.findMany();

  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
      update: {},
      create: { roleId: role.id, permissionId: perm.id },
    });
  }

  console.log(`Physical count permissions seed completed. Added ${addedCount} new permissions.`);
  console.log(`Total permissions linked to SUPER_ADMIN: ${allPermissions.length}`);
}

main()
  .catch((e) => {
    console.error("Physical count permissions seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
