import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const EXTRA_PERMISSIONS: { key: string; module: string; action: string }[] = [
  // business-partner
  { key: "business-partner:create", module: "business-partner", action: "create" },
  { key: "business-partner:read", module: "business-partner", action: "read" },
  { key: "business-partner:update", module: "business-partner", action: "update" },
  { key: "business-partner:delete", module: "business-partner", action: "delete" },
  { key: "business-partner:block", module: "business-partner", action: "block" },
  { key: "business-partner:unblock", module: "business-partner", action: "unblock" },
  { key: "business-partner:changeType", module: "business-partner", action: "changeType" },
  { key: "business-partner:updateStatus", module: "business-partner", action: "updateStatus" },
  // business-partner-group
  { key: "business-partner-group:create", module: "business-partner-group", action: "create" },
  { key: "business-partner-group:read", module: "business-partner-group", action: "read" },
  { key: "business-partner-group:update", module: "business-partner-group", action: "update" },
  { key: "business-partner-group:delete", module: "business-partner-group", action: "delete" },
  // payment-term
  { key: "payment-term:create", module: "payment-term", action: "create" },
  { key: "payment-term:read", module: "payment-term", action: "read" },
  { key: "payment-term:update", module: "payment-term", action: "update" },
  { key: "payment-term:delete", module: "payment-term", action: "delete" },
  // business-partner-contact
  { key: "business-partner-contact:create", module: "business-partner-contact", action: "create" },
  { key: "business-partner-contact:read", module: "business-partner-contact", action: "read" },
  { key: "business-partner-contact:update", module: "business-partner-contact", action: "update" },
  { key: "business-partner-contact:delete", module: "business-partner-contact", action: "delete" },
  // business-partner-address
  { key: "business-partner-address:create", module: "business-partner-address", action: "create" },
  { key: "business-partner-address:read", module: "business-partner-address", action: "read" },
  { key: "business-partner-address:update", module: "business-partner-address", action: "update" },
  { key: "business-partner-address:delete", module: "business-partner-address", action: "delete" },
  // business-partner-bank-account
  { key: "business-partner-bank-account:create", module: "business-partner-bank-account", action: "create" },
  { key: "business-partner-bank-account:read", module: "business-partner-bank-account", action: "read" },
  { key: "business-partner-bank-account:update", module: "business-partner-bank-account", action: "update" },
  { key: "business-partner-bank-account:delete", module: "business-partner-bank-account", action: "delete" },
];

const NUMBER_SEQUENCES = [
  { code: "BUSINESS_PARTNER", name: "Business Partner", operationName: "Business Partner", modelName: "BusinessPartner", domain: "sales", prefix: "BP-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "USER_REJECTED_FOR_CURRENT_RELEASE" },
  { code: "CUSTOMER", name: "Customer", operationName: "Customer", modelName: "Customer", domain: "sales", prefix: "CUS-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "USER_REJECTED_FOR_CURRENT_RELEASE" },
  { code: "SUPPLIER", name: "Supplier", operationName: "Supplier", modelName: "Supplier", domain: "purchasing", prefix: "SUP-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "USER_REJECTED_FOR_CURRENT_RELEASE" },
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

  for (const ns of NUMBER_SEQUENCES) {
    const existing = await prisma.numberSequence.findUnique({ where: { code: ns.code } });
    if (!existing) {
      await prisma.numberSequence.create({ data: ns });
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

  console.log(`Business partner permissions seed completed. Added ${addedCount} new permissions.`);
  console.log(`Total permissions linked to SUPER_ADMIN: ${allPermissions.length}`);
}

main()
  .catch((e) => {
    console.error("Business partner permissions seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
