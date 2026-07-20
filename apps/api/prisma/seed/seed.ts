import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import * as bcrypt from "bcryptjs";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const MODULES = [
  "company", "branch", "department", "user", "role", "permission",
  "warehouse", "warehouse-location", "product-category", "product",
  "inventory", "machine-category", "machine", "machine-part",
  "maintenance-request", "maintenance-task", "maintenance-schedule",
  "maintenance-checklist", "system-setting", "audit-log",
  "notification", "attachment", "numbering",
  "inventory-count", "inventory-count-line", "inventory-movement",
  "inventory-adjustment", "inventory-balance",
  "barcode-label", "barcode-scan", "barcode-template",
  "reports.maintenance", "reports.inventory", "reports.barcodes",
  "search",
  "messaging",
] as const;

const ACTIONS = ["create", "read", "update", "delete"] as const;

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@atsofterp.com";
  const rawPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@123456";

  const company = await prisma.company.upsert({
    where: { code: "DEFAULT" },
    update: {},
    create: {
      code: "DEFAULT",
      name: "Default Company",
      legalName: "ATsoftERP Default Company",
      status: "ACTIVE",
    },
  });

  const branch = await prisma.branch.upsert({
    where: { companyId_code: { companyId: company.id, code: "HQ" } },
    update: {},
    create: {
      companyId: company.id,
      code: "HQ",
      name: "Headquarters",
      status: "ACTIVE",
    },
  });

  const department = await prisma.department.upsert({
    where: { companyId_code: { companyId: company.id, code: "ADMIN" } },
    update: {},
    create: {
      companyId: company.id,
      branchId: branch.id,
      code: "ADMIN",
      name: "Administration",
      status: "ACTIVE",
    },
  });

  const role = await prisma.role.upsert({
    where: { code: "SUPER_ADMIN" },
    update: {},
    create: {
      code: "SUPER_ADMIN",
      name: "Super Administrator",
      description: "Full system access",
      isSystem: true,
      status: "ACTIVE",
    },
  });

  const passwordHash = await bcrypt.hash(rawPassword, 10);

  await prisma.user.upsert({
    where: { email },
    update: {
      name: "Administrator",
      companyId: company.id,
      branchId: branch.id,
      departmentId: department.id,
    },
    create: {
      email,
      passwordHash,
      name: "Administrator",
      companyId: company.id,
      branchId: branch.id,
      departmentId: department.id,
      status: "ACTIVE",
    },
  });

  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email } });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: role.id } },
    update: {},
    create: { userId: adminUser.id, roleId: role.id },
  });

  const permissionRecords: { key: string; module: string; action: string }[] = [];
  for (const module of MODULES) {
    for (const action of ACTIONS) {
      permissionRecords.push({
        key: `${module}:${action}`,
        module,
        action,
      });
    }
  }

  for (const p of permissionRecords) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: {},
      create: { key: p.key, module: p.module, action: p.action, status: "ACTIVE" },
    });
  }

  const extraPermissions = [
    { key: "numbering:generate", module: "numbering", action: "generate" },
    { key: "messaging:send", module: "messaging", action: "send" },
    { key: "messaging:manage", module: "messaging", action: "manage" },
  ];

  for (const p of extraPermissions) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: {},
      create: { key: p.key, module: p.module, action: p.action, status: "ACTIVE" },
    });
  }

  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
      update: {},
      create: { roleId: role.id, permissionId: perm.id },
    });
  }

  const numberSequences = [
    { code: "MAINTENANCE_REQUEST", name: "Maintenance Request", prefix: "MR-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER" },
    { code: "MACHINE", name: "Machine", prefix: "MCH-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER" },
    { code: "PRODUCT", name: "Product", prefix: "PRD-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER" },
    { code: "INVENTORY_COUNT", name: "Inventory Count", prefix: "IC-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER" },
    { code: "INVENTORY_MOVEMENT", name: "Inventory Movement", prefix: "IM-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER" },
    { code: "INVENTORY_ADJUSTMENT", name: "Inventory Adjustment", prefix: "IA-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER" },
    { code: "BARCODE_LABEL", name: "Barcode Label", prefix: "BCL-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER" },
    { code: "QR_LABEL", name: "QR Label", prefix: "QR-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER" },
  ];

  for (const ns of numberSequences) {
    await prisma.numberSequence.upsert({
      where: { code: ns.code },
      update: {},
      create: ns,
    });
  }

  console.log("Seed completed successfully.");
  console.log(`  Company:          ${company.code} (${company.id})`);
  console.log(`  Branch:           ${branch.code} (${branch.id})`);
  console.log(`  Department:       ${department.code} (${department.id})`);
  console.log(`  Role:             ${role.code} (${role.id})`);
  console.log(`  Admin user email: ${email}`);
  console.log(`  Permissions:      ${allPermissions.length} created`);
  console.log(`  Number sequences: ${numberSequences.length} created`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
