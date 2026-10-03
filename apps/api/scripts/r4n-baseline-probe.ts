// R4N read-only live baseline probe. Executes SELECT-only aggregate queries.
// No writes, no transactions that mutate, no DDL.
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';

// Load the root .env exactly as the running application does (never printed).
const rootEnv = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(rootEnv)) {
  for (const line of fs.readFileSync(rootEnv, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

const prisma = new PrismaClient({ adapter: new PrismaMssql(process.env.DATABASE_URL!) });

async function main() {
  const out: Record<string, unknown> = {};

  const scalar = async (label: string, fn: () => Promise<unknown>) => {
    try {
      out[label] = await fn();
    } catch (e) {
      out[label] = `ERROR: ${(e as Error).message}`;
    }
  };

  await scalar('machines.total', () => prisma.machine.count());
  await scalar('machines.active', () => prisma.machine.count({ where: { deletedAt: null, status: 'ACTIVE' } }));
  await scalar('machines.softDeleted', () => prisma.machine.count({ where: { deletedAt: { not: null } } }));
  await scalar('machines.distinctStatus', async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ status: string; n: bigint }>>(
      `SELECT status, COUNT(*) AS n FROM machines GROUP BY status`,
    );
    return rows.map((r) => ({ status: r.status, n: Number(r.n) }));
  });
  await scalar('machines.nullCompany', () => prisma.machine.count({ where: { companyId: null } }));
  await scalar('machines.softDeletedActive', () => prisma.machine.count({ where: { deletedAt: { not: null }, status: 'ACTIVE' } }));

  await scalar('machineParts.total', () => prisma.machinePart.count());
  await scalar('machineParts.bound', () => prisma.machinePart.count({ where: { machineId: { not: null } } }));
  await scalar('machineParts.unbound', () => prisma.machinePart.count({ where: { machineId: null } }));
  await scalar('machineParts.boundToSoftDeletedMachine', () => prisma.machinePart.count({
    where: { machine: { deletedAt: { not: null } } },
  }));
  await scalar('machineParts.withProductId', () => prisma.machinePart.count({ where: { productId: { not: null } } }));
  await scalar('machineParts.withPartNumber', () => prisma.machinePart.count({ where: { partNumber: { not: null } } }));
  await scalar('machineParts.distinctPartNumbers', () => prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(DISTINCT LTRIM(RTRIM(partNumber))) AS n FROM machine_parts WHERE partNumber IS NOT NULL AND LTRIM(RTRIM(partNumber)) <> ''`,
  ).then((r) => Number(r[0].n)));
  await scalar('machineParts.distinctNames', () => prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(DISTINCT LOWER(LTRIM(RTRIM(name)))) AS n FROM machine_parts`,
  ).then((r) => Number(r[0].n)));
  await scalar('machineParts.distinctCodes', () => prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(DISTINCT LOWER(LTRIM(RTRIM(code)))) AS n FROM machine_parts`,
  ).then((r) => Number(r[0].n)));
  await scalar('machineParts.duplicateCodeGroups', () => prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) AS n FROM (SELECT LOWER(LTRIM(RTRIM(code))) c FROM machine_parts GROUP BY LOWER(LTRIM(RTRIM(code))) HAVING COUNT(*) > 1) x`,
  ).then((r) => Number(r[0].n)));

  await scalar('spareParts.total', () => prisma.sparePart.count());
  await scalar('spareParts.active', () => prisma.sparePart.count({ where: { deletedAt: null } }));
  await scalar('spareParts.softDeleted', () => prisma.sparePart.count({ where: { deletedAt: { not: null } } }));
  await scalar('spareParts.withProductId', () => prisma.sparePart.count({ where: { productId: { not: null } } }));
  await scalar('spareParts.withPartNumber', () => prisma.sparePart.count({ where: { partNumber: { not: null } } }));
  await scalar('spareParts.withManufacturer', () => prisma.sparePart.count({ where: { manufacturer: { not: null } } }));
  await scalar('spareParts.distinctPartNumbers', () => prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(DISTINCT LOWER(LTRIM(RTRIM(partNumber)))) AS n FROM spare_parts WHERE partNumber IS NOT NULL AND LTRIM(RTRIM(partNumber)) <> ''`,
  ).then((r) => Number(r[0].n)));
  await scalar('spareParts.duplicatePartNumberGroups', () => prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) AS n FROM (SELECT LOWER(LTRIM(RTRIM(partNumber))) p FROM spare_parts WHERE partNumber IS NOT NULL AND LTRIM(RTRIM(partNumber)) <> '' GROUP BY LOWER(LTRIM(RTRIM(partNumber))) HAVING COUNT(*) > 1) x`,
  ).then((r) => Number(r[0].n)));

  await scalar('machineSpareParts.total', () => prisma.machineSparePart.count());
  await scalar('machineSpareParts.active', () => prisma.machineSparePart.count({ where: { status: 'ACTIVE' } }));
  await scalar('componentSpareParts.total', () => prisma.componentSparePart.count());
  await scalar('machineComponents.total', () => prisma.machineComponent.count());
  await scalar('machineComponents.active', () => prisma.machineComponent.count({ where: { deletedAt: null } }));

  await scalar('machineInstalledParts.total', () => prisma.machineInstalledPart.count());
  await scalar('machineInstalledParts.active', () => prisma.machineInstalledPart.count({ where: { status: 'ACTIVE' } }));

  await scalar('products.total', () => prisma.product.count());
  await scalar('warehouses.total', () => prisma.warehouse.count());
  await scalar('inventoryMovements.total', () => prisma.inventoryMovement.count());
  await scalar('maintenanceWorkOrderParts.total', () => prisma.maintenanceWorkOrderPart.count());
  await scalar('maintenanceRequestRequiredParts.total', () => prisma.maintenanceRequestRequiredPart.count());
  await scalar('companies.total', () => prisma.company.count());

  // Does machine_parts already have a spare-part column in the live DB?
  await scalar('db.machinePartsColumns', () => prisma.$queryRawUnsafe<Array<{ COLUMN_NAME: string }>>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'machine_parts' ORDER BY COLUMN_NAME`,
  ).then((r) => r.map((x) => x.COLUMN_NAME)));
  await scalar('db.machinePartsFKs', () => prisma.$queryRawUnsafe<Array<{ FK_NAME: string }>>(
    `SELECT fk.name AS FK_NAME FROM sys.foreign_keys fk
     JOIN sys.tables t ON t.object_id = fk.parent_object_id
     WHERE t.name = 'machine_parts' ORDER BY fk.name`,
  ).then((r) => r.map((x) => x.FK_NAME)));

  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error('FATAL', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());