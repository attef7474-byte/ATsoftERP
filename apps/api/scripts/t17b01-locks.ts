import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const locks = await prisma.inventoryLock.findMany({
    select: { id: true, code: true, lockType: true, status: true, dateFrom: true, dateTo: true, warehouseId: true, locationId: true, productId: true },
    take: 50,
  });
  console.log("INVENTORY_LOCKS", JSON.stringify(locks, null, 2));
}

main()
  .catch((error) => {
    console.error("FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
