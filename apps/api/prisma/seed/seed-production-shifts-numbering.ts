import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

export const PRODUCTION_SHIFTS_NUMBER_SEQUENCES = [
  { code: "PRODUCTION_SHIFT", name: "Production Shift", operationName: "Production Shift", modelName: "ProductionShift", domain: "production", prefix: "PS-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
  { code: "PRODUCTION_SHIFT_TEMPLATE", name: "Production Shift Template", operationName: "Production Shift Template", modelName: "ProductionShiftTemplate", domain: "production", prefix: "PST-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
  { code: "PRODUCTION_SHIFT_CALENDAR", name: "Production Shift Calendar", operationName: "Production Shift Calendar", modelName: "ProductionShiftCalendar", domain: "production", prefix: "PSC-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
  { code: "PRODUCTION_SHIFT_ASSIGNMENT", name: "Production Shift Assignment", operationName: "Production Shift Assignment", modelName: "ProductionShiftAssignment", domain: "production", prefix: "PSA-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
  { code: "PRODUCTION_OPERATIONAL_ASSIGNMENT", name: "Production Operational Assignment", operationName: "Production Operational Assignment", modelName: "ProductionOperationalAssignment", domain: "production", prefix: "POA-", padding: 6, scope: "GLOBAL", resetPolicy: "NEVER", status: "ACTIVE" },
];

export async function seedProductionShiftsNumbering(prisma: PrismaClient): Promise<void> {
  for (const ns of PRODUCTION_SHIFTS_NUMBER_SEQUENCES) {
    const existing = await prisma.numberSequence.findUnique({ where: { code: ns.code } });
    if (!existing) {
      await prisma.numberSequence.create({ data: ns });
      console.log(`  Created number sequence ${ns.code}`);
    } else {
      console.log(`  Number sequence ${ns.code} already exists`);
    }
  }
  console.log("Production shift & assignment numbering seed completed.");
}

async function main() {
  const adapter = new PrismaMssql(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });
  try {
    await seedProductionShiftsNumbering(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error("Production shift numbering seed failed:", e);
      process.exit(1);
    });
}
