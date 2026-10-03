// R4N read-only reconciliation analysis.
// Classifies every MachinePart against the SparePart catalog using ONLY the
// strongest verified technical identity available. Emits evidence only; no writes.
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';

const rootEnv = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(rootEnv)) {
  for (const line of fs.readFileSync(rootEnv, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

const prisma = new PrismaClient({ adapter: new PrismaMssql(process.env.DATABASE_URL!) });

const norm = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

type Row = {
  id: string;
  code: string;
  name: string;
  machineId: string | null;
  productId: string | null;
  partNumber: string | null;
  quantity: number;
  minStock: number;
  unit: string;
};

async function main() {
  const [mps, sps] = await Promise.all([
    prisma.machinePart.findMany({
      select: { id: true, code: true, name: true, machineId: true, productId: true, partNumber: true, quantity: true, minStock: true, unit: true },
    }),
    prisma.sparePart.findMany({
      select: { id: true, code: true, name: true, description: true, category: true, specification: true, unit: true, manufacturer: true, model: true, partNumber: true, barcode: true, productId: true, status: true, deletedAt: true },
    }),
  ]);

  const machines = await prisma.machine.findMany({ select: { id: true, code: true, name: true, companyId: true, branchId: true, deletedAt: true } });
  const machineById = new Map(machines.map((m) => [m.id, m]));

  // --- Identity indices over the SparePart catalog ---
  const byProduct = new Map<string, typeof sps>();
  const byPartNumber = new Map<string, typeof sps>();
  const byName = new Map<string, typeof sps>();
  const push = <T,>(map: Map<string, T[]>, k: string, v: T) => {
    const a = map.get(k);
    if (a) a.push(v); else map.set(k, [v]);
  };
  for (const sp of sps) {
    if (sp.productId) push(byProduct, sp.productId, sp);
    if (sp.partNumber && norm(sp.partNumber)) push(byPartNumber, norm(sp.partNumber), sp);
    if (norm(sp.name)) push(byName, norm(sp.name), sp);
  }

  const usable = sps.filter((s) => s.deletedAt === null && s.status === 'ACTIVE');

  const cls: Record<string, number> = {
    EXACT_CANONICAL_MATCH: 0,
    VERIFIED_NEW_CANONICAL_ITEM: 0,
    AMBIGUOUS_TECHNICAL_IDENTITY: 0,
    CONFLICTING_EXISTING_ITEMS: 0,
    UNKNOWN_RECORD_OWNERSHIP: 0,
    INSUFFICIENT_SOURCE_EVIDENCE: 0,
  };

  const detail: Array<Record<string, unknown>> = [];
  const nameOverlapSamples: Array<Record<string, unknown>> = [];
  const seenNameOverlap = new Set<string>();

  for (const mp of mps as Row[]) {
    // Ownership is only knowable through a bound Machine.
    const machine = mp.machineId ? machineById.get(mp.machineId) : null;
    const ownershipKnown = !!machine && !!machine.companyId;
    if (!ownershipKnown) {
      cls.UNKNOWN_RECORD_OWNERSHIP += 1;
      detail.push({
        code: mp.code,
        name: mp.name,
        reason: mp.machineId
          ? 'bound machine missing companyId or machine row'
          : 'unbound MachinePart has no companyId/branchId column',
      });
      continue;
    }

    // Strongest verified identity: verified Product identity, then part number.
    let matched: typeof sps | null = null;
    let basis = '';
    if (mp.productId) {
      const c = byProduct.get(mp.productId);
      if (c && c.length === 1) { matched = c; basis = 'productId'; }
      else if (c && c.length > 1) { cls.CONFLICTING_EXISTING_ITEMS += 1; detail.push({ code: mp.code, reason: `productId maps to ${c.length} SpareParts` }); continue; }
    }
    if (!matched && mp.partNumber) {
      const c = byPartNumber.get(norm(mp.partNumber));
      if (c && c.length === 1) { matched = c; basis = 'partNumber'; }
      else if (c && c.length > 1) { cls.CONFLICTING_EXISTING_ITEMS += 1; detail.push({ code: mp.code, reason: `partNumber maps to ${c.length} SpareParts` }); continue; }
    }

    if (matched) {
      cls.EXACT_CANONICAL_MATCH += 1;
      detail.push({ code: mp.code, name: mp.name, matched: matched[0].code, basis });
      continue;
    }

    // No strong identity. A display-name collision alone is NOT sufficient evidence.
    const nameHits = byName.get(norm(mp.name)) ?? [];
    if (nameHits.length > 0) {
      const live = nameHits.filter((s) => s.deletedAt === null);
      const distinctSpec = new Set(nameHits.map((s) => norm(s.specification) || '(none)'));
      cls.AMBIGUOUS_TECHNICAL_IDENTITY += 1;
      detail.push({
        code: mp.code,
        name: mp.name,
        reason: 'display-name collision only; no partNumber/productId on MachinePart',
        catalogHits: nameHits.map((s) => s.code),
        distinctSpecifications: distinctSpec.size,
        hasManufacturerEvidence: nameHits.some((s) => !!s.manufacturer),
      });
      if (!seenNameOverlap.has(norm(mp.name)) && nameOverlapSamples.length < 25) {
        seenNameOverlap.add(norm(mp.name));
        nameOverlapSamples.push({
          machinePartCode: mp.code,
          machinePartName: mp.name,
          machinePartUnit: mp.unit,
          catalog: nameHits.map((s) => ({
            code: s.code, name: s.name, specification: s.specification,
            manufacturer: s.manufacturer, partNumber: s.partNumber,
            productId: s.productId, status: s.status, deleted: s.deletedAt !== null,
          })),
        });
      }
      continue;
    }

    // Creating a canonical item requires verified technical evidence, which must
    // never be invented. MachinePart carries no specification/manufacturer.
    const hasTechEvidence = !!(mp.partNumber || mp.productId);
    if (hasTechEvidence) {
      cls.VERIFIED_NEW_CANONICAL_ITEM += 1;
      detail.push({ code: mp.code, name: mp.name, reason: 'no catalog match, technical identity present' });
    } else {
      cls.INSUFFICIENT_SOURCE_EVIDENCE += 1;
    }
  }

  const boundMps = mps.filter((m) => m.machineId);
  const nameDistinct = new Set(mps.map((m) => norm(m.name)));

  console.log(JSON.stringify({
    summary: {
      machinePartsTotal: mps.length,
      machinePartsBound: boundMps.length,
      machinePartsUnbound: mps.length - boundMps.length,
      machinePartsDistinctNames: nameDistinct.size,
      machinePartsWithProductId: mps.filter((m) => m.productId).length,
      machinePartsWithPartNumber: mps.filter((m) => m.partNumber && String(m.partNumber).trim()).length,
      sparePartsTotal: sps.length,
      sparePartsUsableActive: usable.length,
      machineSparePartsRows: 0,
      classification: cls,
    },
    nameOverlapSamples,
    ambiguousDetailSample: detail.filter((d) => d.reason && String(d.reason).startsWith('display-name')).slice(0, 20),
    unknownOwnershipSample: detail.filter((d) => String(d.reason || '').includes('unbound') || String(d.reason || '').includes('no companyId')).slice(0, 5),
  }, null, 2));
}

main().catch((e) => { console.error('FATAL', e); process.exitCode = 1; }).finally(() => prisma.$disconnect());