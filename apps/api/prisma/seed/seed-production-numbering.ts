import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const NUMBER_SEQUENCES = [
  { code: "PRODUCTION_UNIT", name: "Production Unit", operationName: "Production Unit", modelName: "ProductionUnit", domain: "production", prefix: "PU-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
  { code: "PRODUCTION_PRODUCT", name: "Production Product Definition", operationName: "Production Product Definition", modelName: "ProductionProductDefinition", domain: "production", prefix: "PP-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
];

async function main() {
  for (const ns of NUMBER_SEQUENCES) {
    const existing = await prisma.numberSequence.findUnique({ where: { code: ns.code } });
    if (!existing) {
      await prisma.numberSequence.create({ data: ns });
      console.log(`  Created number sequence ${ns.code}`);
    } else {
      console.log(`  Number sequence ${ns.code} already exists`);
    }
  }
  console.log("Production numbering seed completed.");
}

main()
  .catch((e) => {
    console.error("Production numbering seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
