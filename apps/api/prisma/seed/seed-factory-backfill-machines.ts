import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Backfill Machines: Production Line / Operation Type / Cost Center ===\n');

  const machines = await prisma.machine.findMany({ where: { deletedAt: null } });
  console.log(`Total active machines: ${machines.length}`);

  let linked = 0;
  let unlinked = 0;
  let withOpType = 0;
  let withoutOpType = 0;
  let withCostCenter = 0;
  let withoutCostCenter = 0;
  let withTechAdmin = 0;
  let withoutTechAdmin = 0;
  let withTechDept = 0;
  let withoutTechDept = 0;

  for (const machine of machines) {
    let productionLineId = null;
    let operationTypeId = null;
    let defaultCostCenterId = null;
    let technicalAdministrationId = null;
    let technicalDepartmentId = null;

    if (machine.departmentId) {
      const lines = await prisma.productionLine.findMany({
        where: { departmentId: machine.departmentId, status: 'ACTIVE', deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      if (lines.length > 0) {
        const chosen = lines.find(l => l.name.includes('General') || l.name.includes('عام')) || lines[0];
        productionLineId = chosen.id;
        operationTypeId = chosen.operationTypeId;
        if (chosen.costCenterId) defaultCostCenterId = chosen.costCenterId;
      }
    }

    if (productionLineId) linked++; else unlinked++;
    if (operationTypeId) withOpType++; else withoutOpType++;
    if (defaultCostCenterId) withCostCenter++; else withoutCostCenter++;

    await prisma.machine.update({
      where: { id: machine.id },
      data: {
        productionLineId,
        operationTypeId,
        defaultCostCenterId,
        technicalAdministrationId,
        technicalDepartmentId,
      },
    });
  }

  console.log(`\nBackfill complete:`);
  console.log(`  Machines with productionLineId:     ${linked}`);
  console.log(`  Machines without productionLineId:  ${unlinked}`);
  console.log(`  Machines with operationTypeId:      ${withOpType}`);
  console.log(`  Machines without operationTypeId:   ${withoutOpType}`);
  console.log(`  Machines with defaultCostCenterId:  ${withCostCenter}`);
  console.log(`  Machines without defaultCostCenterId: ${withoutCostCenter}`);
  console.log(`  Machines with technicalAdmin:       ${withTechAdmin}`);
  console.log(`  Machines without technicalAdmin:    ${withoutTechAdmin}`);
  console.log(`  Machines with technicalDept:        ${withTechDept}`);
  console.log(`  Machines without technicalDept:     ${withoutTechDept}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
