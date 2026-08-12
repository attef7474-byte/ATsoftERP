import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, name: true },
  });
  console.log("COMPANIES", JSON.stringify(companies));

  for (const company of companies) {
    const branches = await prisma.branch.findMany({
      where: { companyId: company.id, deletedAt: null },
      select: { id: true, code: true, name: true },
    });
    console.log(`BRANCHES[${company.code}]`, JSON.stringify(branches));
    const warehouses = await prisma.warehouse.findMany({
      where: { companyId: company.id, deletedAt: null },
      select: { id: true, code: true, name: true, branchId: true },
      take: 5,
    });
    console.log(`WAREHOUSES[${company.code}]`, JSON.stringify(warehouses));
  }

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, name: true },
    take: 5,
  });
  console.log("PRODUCTS", JSON.stringify(products));

  const admin = await prisma.user.findFirst({
    where: { email: process.env.SEED_ADMIN_EMAIL, deletedAt: null },
    select: { id: true, email: true, status: true, companyId: true, branchId: true, roles: { select: { role: { select: { code: true } } } } },
  });
  console.log("ADMIN", JSON.stringify(admin));

  const stockPerms = await prisma.permission.findMany({
    where: { key: { startsWith: "inventory:stock-adjustment" } },
    select: { key: true },
    orderBy: { key: "asc" },
  });
  console.log("STOCK_ADJUSTMENT_PERMS", JSON.stringify(stockPerms.map((p) => p.key)));
}

main()
  .catch((error) => {
    console.error("DISCOVERY FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
