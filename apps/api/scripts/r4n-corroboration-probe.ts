// R4N read-only corroboration probe for the "64 redundant bindings" and
// component-liveness claims in the task brief.
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';

const rootEnv = path.resolve(__dirname, '../../../.env');
for (const line of fs.readFileSync(rootEnv, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1]] === undefined) process.env[m[1]] = v;
}

const prisma = new PrismaClient({ adapter: new PrismaMssql(process.env.DATABASE_URL!) });

async function main() {
  const dupNamePerMachine = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT COUNT(*) AS n FROM (
       SELECT machineId, LOWER(LTRIM(RTRIM(name))) AS nm, COUNT(*) AS c
       FROM machine_parts WHERE machineId IS NOT NULL
       GROUP BY machineId, LOWER(LTRIM(RTRIM(name))) HAVING COUNT(*) > 1
     ) x`,
  );
  const machinesWithParts = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT COUNT(DISTINCT machineId) AS n FROM machine_parts WHERE machineId IS NOT NULL`,
  );
  const componentLive = await prisma.$queryRawUnsafe<Array<{ live: number; n: number }>>(
    `SELECT CASE WHEN deletedAt IS NULL THEN 1 ELSE 0 END AS live, COUNT(*) AS n
     FROM machine_components GROUP BY CASE WHEN deletedAt IS NULL THEN 1 ELSE 0 END`,
  );
  const spareParts = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT code, name, status,
            CASE WHEN deletedAt IS NULL THEN 1 ELSE 0 END AS live,
            manufacturer, model, partNumber, productId, specification
     FROM spare_parts ORDER BY code`,
  );
  const machinePartCompanies = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT COUNT(*) AS n FROM machine_parts mp
     JOIN machines m ON m.id = mp.machineId
     WHERE m.companyId IS NULL`,
  );

  console.log(JSON.stringify({
    duplicateMachineNameGroups: Number(dupNamePerMachine[0].n),
    machinesWithParts: Number(machinesWithParts[0].n),
    boundPartsWhoseMachineHasNoCompany: Number(machinePartCompanies[0].n),
    machineComponentsLiveness: componentLive.map((r) => ({ live: Boolean(r.live), n: Number(r.n) })),
    spareParts,
  }, null, 2));
}

main().catch((e) => { console.error('FATAL', e); process.exitCode = 1; }).finally(() => prisma.$disconnect());