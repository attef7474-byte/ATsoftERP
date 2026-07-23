import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import * as bcrypt from "bcryptjs";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const MODULES = [
  "company", "branch", "administration", "department", "user", "role", "permission",
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
  "operation-type", "cost-center", "production-line",
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
      passwordHash,
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
    { key: "operation-type:activate", module: "operation-type", action: "activate" },
    { key: "operation-type:deactivate", module: "operation-type", action: "deactivate" },
    { key: "cost-center:activate", module: "cost-center", action: "activate" },
    { key: "cost-center:deactivate", module: "cost-center", action: "deactivate" },
    { key: "production-line:activate", module: "production-line", action: "activate" },
    { key: "production-line:deactivate", module: "production-line", action: "deactivate" },
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
    // Core
    { code: "COMPANY", name: "Company", operationName: "Company", modelName: "Company", domain: "core", prefix: "COM-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "BRANCH", name: "Branch", operationName: "Branch", modelName: "Branch", domain: "core", prefix: "BRN-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "DEPARTMENT", name: "Department", operationName: "Department", modelName: "Department", domain: "core", prefix: "DEP-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "ADMINISTRATION", name: "Administration", operationName: "Administration", modelName: "Administration", domain: "core", prefix: "ADM-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },

    // Inventory
    { code: "WAREHOUSE", name: "Warehouse", operationName: "Warehouse", modelName: "Warehouse", domain: "inventory", prefix: "WH-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "WAREHOUSE_LOCATION", name: "Warehouse Location", operationName: "Warehouse Location", modelName: "WarehouseLocation", domain: "inventory", prefix: "WL-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "PRODUCT", name: "Product", operationName: "Product", modelName: "Product", domain: "inventory", prefix: "PRD-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "INVENTORY_MOVEMENT", name: "Inventory Movement", operationName: "Inventory Movement", modelName: "InventoryMovement", domain: "inventory", prefix: "IM-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "INVENTORY_COUNT", name: "Inventory Count", operationName: "Inventory Count", modelName: "InventoryCount", domain: "inventory", prefix: "IC-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "INVENTORY_ADJUSTMENT", name: "Inventory Adjustment", operationName: "Inventory Adjustment", modelName: "InventoryAdjustment", domain: "inventory", prefix: "IA-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },

    // Maintenance
    { code: "MACHINE", name: "Machine", operationName: "Machine", modelName: "Machine", domain: "maintenance", prefix: "MCH-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "MACHINE_ASSET", name: "Machine Asset", operationName: "Machine Asset", modelName: "MachineAsset", domain: "maintenance", prefix: "MAST-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "MACHINE_PART", name: "Machine Part", operationName: "Machine Part", modelName: "MachinePart", domain: "maintenance", prefix: "MPP-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "MACHINE_DOCUMENT", name: "Machine Document", operationName: "Machine Document", modelName: "MachineDocument", domain: "maintenance", prefix: "MDC-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "MAINTENANCE_REQUEST", name: "Maintenance Request", operationName: "Maintenance Request", modelName: "MaintenanceRequest", domain: "maintenance", prefix: "MR-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "MAINTENANCE_TASK", name: "Maintenance Task", operationName: "Maintenance Task", modelName: "MaintenanceTask", domain: "maintenance", prefix: "MTK-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "PREVENTIVE_MAINTENANCE", name: "Preventive Maintenance", operationName: "Preventive Maintenance", modelName: "PreventiveMaintenance", domain: "maintenance", prefix: "PM-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "DOWNTIME", name: "Downtime", operationName: "Downtime", modelName: "DowntimeLog", domain: "maintenance", prefix: "DT-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "OPERATION_TYPE", name: "Operation Type", operationName: "Operation Type", modelName: "OperationType", domain: "maintenance", prefix: "OT-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "COST_CENTER", name: "Cost Center", operationName: "Cost Center", modelName: "CostCenter", domain: "maintenance", prefix: "CC-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "PRODUCTION_LINE", name: "Production Line", operationName: "Production Line", modelName: "ProductionLine", domain: "maintenance", prefix: "PL-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },

    // Barcode/QR
    { code: "BARCODE_LABEL", name: "Barcode Label", operationName: "Barcode Label", modelName: "BarcodeLabel", domain: "barcode", prefix: "BCL-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "QR_LABEL", name: "QR Label", operationName: "QR Label", modelName: "QRLabel", domain: "barcode", prefix: "QR-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "BARCODE_RECORD", name: "Barcode Record", operationName: "Barcode Record", modelName: "BarcodeRecord", domain: "barcode", prefix: "BCR-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "BARCODE_PRINT_JOB", name: "Barcode Print Job", operationName: "Barcode Print Job", modelName: "BarcodePrintJob", domain: "barcode", prefix: "BPJ-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },

    // Reports
    { code: "REPORT_EXPORT_JOB", name: "Report Export Job", operationName: "Report Export Job", modelName: "ReportExportJob", domain: "reports", prefix: "REP-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },

    // System
    { code: "ATTACHMENT", name: "Attachment", operationName: "Attachment", modelName: "Attachment", domain: "system", prefix: "ATT-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
    { code: "NOTIFICATION_RULE", name: "Notification Rule", operationName: "Notification Rule", modelName: "NotificationRule", domain: "system", prefix: "NTR-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },

    // Rejected domains - marked as USER_REJECTED_FOR_CURRENT_RELEASE
    { code: "BUSINESS_PARTNER", name: "Business Partner", operationName: "Business Partner", modelName: "BusinessPartner", domain: "sales", prefix: "BP-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "USER_REJECTED_FOR_CURRENT_RELEASE" },
    { code: "CUSTOMER", name: "Customer", operationName: "Customer", modelName: "Customer", domain: "sales", prefix: "CUS-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "USER_REJECTED_FOR_CURRENT_RELEASE" },
    { code: "SUPPLIER", name: "Supplier", operationName: "Supplier", modelName: "Supplier", domain: "purchasing", prefix: "SUP-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "USER_REJECTED_FOR_CURRENT_RELEASE" },
    { code: "SALES_ORDER", name: "Sales Order", operationName: "Sales Order", modelName: "SalesOrder", domain: "sales", prefix: "SO-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "USER_REJECTED_FOR_CURRENT_RELEASE" },
    { code: "PURCHASE_ORDER", name: "Purchase Order", operationName: "Purchase Order", modelName: "PurchaseOrder", domain: "purchasing", prefix: "PO-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "USER_REJECTED_FOR_CURRENT_RELEASE" },
    { code: "INVOICE", name: "Invoice", operationName: "Invoice", modelName: "Invoice", domain: "finance", prefix: "INV-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "USER_REJECTED_FOR_CURRENT_RELEASE" },
    { code: "HR_EMPLOYEE", name: "HR Employee", operationName: "HR Employee", modelName: "Employee", domain: "hr", prefix: "EMP-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "USER_REJECTED_FOR_CURRENT_RELEASE" },
    { code: "FINANCE_TRANSACTION", name: "Finance Transaction", operationName: "Finance Transaction", modelName: "FinanceTransaction", domain: "finance", prefix: "FT-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "USER_REJECTED_FOR_CURRENT_RELEASE" },
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
