import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const SEARCH_PERMISSIONS: { key: string; module: string; action: string }[] = [
  { key: "search.global:use", module: "search", action: "use" },
  { key: "search.entities:view", module: "search", action: "view" },
  { key: "search.recent:view", module: "search", action: "view" },
  { key: "search.recent:manage", module: "search", action: "manage" },
];

async function main() {
  let addedCount = 0;

  for (const p of SEARCH_PERMISSIONS) {
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

  console.log(`Search permissions seed completed. Added ${addedCount} new permissions.`);
  console.log(`Total permissions linked to SUPER_ADMIN: ${allPermissions.length}`);
}

main()
  .catch((e) => {
    console.error("Search permissions seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
