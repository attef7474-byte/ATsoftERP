// R4N post-migration functional probe.
// READ-ONLY. Confirms the application data path reads the new canonical link
// through the real Prisma model against production.
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
  // Exactly the include shape the service uses on list/detail reads.
  const sample = await prisma.machinePart.findFirst({
    orderBy: { code: 'asc' },
    include: {
      machine: { select: { id: true, name: true, code: true } },
      product: { select: { id: true, name: true, code: true } },
      sparePart: { select: { id: true, code: true, name: true, partNumber: true, manufacturer: true, specification: true, unit: true } },
    },
  });

  const page = await prisma.machinePart.findMany({
    take: 5,
    orderBy: { code: 'asc' },
    include: { sparePart: { select: { id: true, code: true, name: true } } },
  });

  // Canonical catalog is still reachable and linked-applicability still intact.
  const catalog = await prisma.sparePart.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, name: true, manufacturer: true, partNumber: true, status: true },
    orderBy: { code: 'asc' },
  });
  const machineLinks = await prisma.machineSparePart.count();

  // Confirm the reverse relation resolves from the catalog side too.
  const withBackRel = await prisma.sparePart.findFirst({
    where: { deletedAt: null },
    select: { id: true, code: true, _count: { select: { machinePartCanonicalLinks: true, machineLinks: true } } },
    orderBy: { code: 'asc' },
  });

  console.log(JSON.stringify({
    readSample: {
      code: sample?.code,
      name: sample?.name,
      sparePartId: sample?.sparePartId ?? null,
      sparePartRelationResolves: sample?.sparePart === null || sample?.sparePart === undefined,
      machineCode: sample?.machine?.code ?? null,
    },
    listPage: page.map((p) => ({ code: p.code, sparePartCode: p.sparePart?.code ?? null })),
    canonicalCatalogLiveCount: catalog.length,
    canonicalCatalog: catalog.map((c) => ({ code: c.code, name: c.name, manufacturer: c.manufacturer, partNumber: c.partNumber, status: c.status })),
    machineSparePartApplicabilityLinks: machineLinks,
    reverseRelationCheck: withBackRel,
  }, null, 2));
}

main().catch((e) => { console.error('FATAL', e); process.exitCode = 1; }).finally(() => prisma.$disconnect());