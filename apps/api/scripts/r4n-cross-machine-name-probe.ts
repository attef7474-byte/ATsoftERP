// R4N read-only probe: cross-machine name reuse, the only plausible
// reconciliation signal available. Emits evidence only; no writes.
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
  const crossMachine = await prisma.$queryRawUnsafe<Array<{ nm: string; rows: number; machines: number; units: number; qtyVariants: number }>>(
    `SELECT LOWER(LTRIM(RTRIM(name))) AS nm,
            COUNT(*) AS rows,
            COUNT(DISTINCT machineId) AS machines,
            COUNT(DISTINCT LOWER(LTRIM(RTRIM(unit)))) AS units,
            COUNT(DISTINCT quantity) AS qtyVariants
     FROM machine_parts WHERE machineId IS NOT NULL
     GROUP BY LOWER(LTRIM(RTRIM(name)))
     HAVING COUNT(DISTINCT machineId) > 1
     ORDER BY COUNT(DISTINCT machineId) DESC, COUNT(*) DESC`,
  );
  const total = await prisma.machinePart.count();
  const covered = crossMachine.reduce((a, r) => a + Number(r.rows), 0);
  const sameNameSameUnit = crossMachine.filter((r) => Number(r.units) === 1).length;

  console.log(JSON.stringify({
    boundParts: Number(total) - 167,
    distinctCrossMachineNames: crossMachine.length,
    boundPartsCoveredByCrossMachineName: covered,
    namesWithSingleConsistentUnit: sameNameSameUnit,
    top15: crossMachine.slice(0, 15).map((r) => ({
      name: r.nm, rows: Number(r.rows), machines: Number(r.machines),
      distinctUnits: Number(r.units), quantityVariants: Number(r.qtyVariants),
    })),
  }, null, 2));
}

main().catch((e) => { console.error('FATAL', e); process.exitCode = 1; }).finally(() => prisma.$disconnect());