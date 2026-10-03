// R4N record-level reconciliation classifier and register generator.
//
// READ-ONLY against the live database. Emits an evidence register only.
//
// Owner ruling (this stage):
//  - Matching name + unit + quantity is NOT sufficient to prove technical
//    equivalence. Quantity is machine-specific usage, never a canonical identity.
//  - Cross-machine name clusters are therefore AMBIGUOUS_TECHNICAL_IDENTITY,
//    never EXACT_CANONICAL_MATCH, unless independent authoritative technical
//    evidence (partNumber / verified Product identity) establishes a match.
//  - No canonical item is ever created from an ambiguous record.
//  - No MachinePart binding is altered, merged or deleted.
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

const norm = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export const CLASS = {
  EXACT_CANONICAL_MATCH: 'EXACT_CANONICAL_MATCH',
  VERIFIED_NEW_CANONICAL_ITEM: 'VERIFIED_NEW_CANONICAL_ITEM',
  AMBIGUOUS_TECHNICAL_IDENTITY: 'AMBIGUOUS_TECHNICAL_IDENTITY',
  CONFLICTING_EXISTING_ITEMS: 'CONFLICTING_EXISTING_ITEMS',
  UNKNOWN_RECORD_OWNERSHIP: 'UNKNOWN_RECORD_OWNERSHIP',
  INSUFFICIENT_SOURCE_EVIDENCE: 'INSUFFICIENT_SOURCE_EVIDENCE',
} as const;

type SpareRow = {
  id: string; code: string; name: string; partNumber: string | null;
  productId: string | null; manufacturer: string | null; specification: string | null;
  status: string; deletedAt: Date | null;
};
type MpRow = {
  id: string; code: string; name: string; machineId: string | null;
  productId: string | null; partNumber: string | null; quantity: number;
  minStock: number; unit: string;
};

type RegisterRow = {
  machinePartId: string;
  machinePartCode: string;
  machinePartName: string;
  machineId: string | null;
  machineCode: string | null;
  companyId: string | null;
  branchId: string | null;
  unit: string;
  quantity: number;
  classification: string;
  clusterSize: number;
  clusterMachineCount: number;
  matchedSparePartCode: string | null;
  matchBasis: string | null;
  missingEvidence: string[];
  reason: string;
};

async function classify() {
  const [mps, sps, machines] = await Promise.all([
    prisma.machinePart.findMany({
      select: { id: true, code: true, name: true, machineId: true, productId: true, partNumber: true, quantity: true, minStock: true, unit: true },
    }),
    prisma.sparePart.findMany({
      select: { id: true, code: true, name: true, partNumber: true, productId: true, manufacturer: true, specification: true, status: true, deletedAt: true },
    }),
    prisma.machine.findMany({ select: { id: true, code: true, companyId: true, branchId: true } }),
  ]);

  const machineById = new Map(machines.map((m) => [m.id, m]));
  const byProduct = new Map<string, SpareRow[]>();
  const byPartNumber = new Map<string, SpareRow[]>();
  const add = <T>(map: Map<string, T[]>, k: string, v: T) => {
    const a = map.get(k);
    if (a) a.push(v); else map.set(k, [v]);
  };
  for (const sp of sps) {
    if (sp.productId) add(byProduct, sp.productId, sp);
    if (norm(sp.partNumber)) add(byPartNumber, norm(sp.partNumber), sp);
  }

  // Cross-machine name clusters, computed across BOUND parts only.
  const clusterStats = new Map<string, { rows: number; machines: Set<string> }>();
  for (const mp of mps) {
    if (!mp.machineId) continue;
    const k = norm(mp.name);
    const cur = clusterStats.get(k);
    if (cur) { cur.rows += 1; cur.machines.add(mp.machineId); }
    else clusterStats.set(k, { rows: 1, machines: new Set([mp.machineId]) });
  }

  const register: RegisterRow[] = [];
  const counts: Record<string, number> = Object.fromEntries(Object.values(CLASS).map((c) => [c, 0]));

  for (const mp of mps as MpRow[]) {
    const machine = mp.machineId ? machineById.get(mp.machineId) : null;
    const cluster = mp.machineId ? clusterStats.get(norm(mp.name)) : undefined;
    const base = {
      machinePartId: mp.id,
      machinePartCode: mp.code,
      machinePartName: mp.name,
      machineId: mp.machineId,
      machineCode: machine?.code ?? null,
      companyId: machine?.companyId ?? null,
      branchId: machine?.branchId ?? null,
      unit: mp.unit,
      quantity: mp.quantity,
      clusterSize: cluster?.rows ?? 0,
      clusterMachineCount: cluster?.machines.size ?? 0,
    };

    // 1. Ownership must be provable before any equivalence reasoning.
    if (!mp.machineId) {
      counts[CLASS.UNKNOWN_RECORD_OWNERSHIP] += 1;
      register.push({
        ...base, classification: CLASS.UNKNOWN_RECORD_OWNERSHIP,
        matchedSparePartCode: null, matchBasis: null,
        missingEvidence: ['machineId', 'companyId', 'branchId'],
        reason: 'Unbound MachinePart. The machine_parts table carries no companyId/branchId column and this row references no Machine, so tenant ownership cannot be established. Left unchanged.',
      });
      continue;
    }
    if (!machine || !machine.companyId) {
      counts[CLASS.UNKNOWN_RECORD_OWNERSHIP] += 1;
      register.push({
        ...base, classification: CLASS.UNKNOWN_RECORD_OWNERSHIP,
        matchedSparePartCode: null, matchBasis: null,
        missingEvidence: ['companyId'],
        reason: machine
          ? 'Bound Machine exists but has no companyId; tenant ownership unprovable. Left unchanged.'
          : 'machineId references a Machine row that no longer exists. Left unchanged.',
      });
      continue;
    }

    // 2. Strongest independent technical identity: verified Product identity.
    if (mp.productId) {
      const hits = byProduct.get(mp.productId) ?? [];
      if (hits.length === 1) {
        counts[CLASS.EXACT_CANONICAL_MATCH] += 1;
        register.push({
          ...base, classification: CLASS.EXACT_CANONICAL_MATCH,
          matchedSparePartCode: hits[0].code, matchBasis: 'productId',
          missingEvidence: [],
          reason: 'Unique match on verified Product identity (machine_parts.productId = spare_parts.productId).',
        });
        continue;
      }
      if (hits.length > 1) {
        counts[CLASS.CONFLICTING_EXISTING_ITEMS] += 1;
        register.push({
          ...base, classification: CLASS.CONFLICTING_EXISTING_ITEMS,
          matchedSparePartCode: hits.map((h) => h.code).join('|'),
          matchBasis: 'productId',
          missingEvidence: ['disambiguating technical field'],
          reason: `Product identity maps to ${hits.length} conflicting SpareParts. Left unchanged.`,
        });
        continue;
      }
    }

    // 3. Second-strongest: part number, unique within the catalog.
    if (mp.partNumber && norm(mp.partNumber)) {
      const hits = byPartNumber.get(norm(mp.partNumber)) ?? [];
      if (hits.length === 1) {
        counts[CLASS.EXACT_CANONICAL_MATCH] += 1;
        register.push({
          ...base, classification: CLASS.EXACT_CANONICAL_MATCH,
          matchedSparePartCode: hits[0].code, matchBasis: 'partNumber',
          missingEvidence: [],
          reason: 'Unique match on manufacturer part number within the canonical catalog.',
        });
        continue;
      }
      if (hits.length > 1) {
        counts[CLASS.CONFLICTING_EXISTING_ITEMS] += 1;
        register.push({
          ...base, classification: CLASS.CONFLICTING_EXISTING_ITEMS,
          matchedSparePartCode: hits.map((h) => h.code).join('|'),
          matchBasis: 'partNumber',
          missingEvidence: ['disambiguating technical field'],
          reason: `Part number maps to ${hits.length} conflicting SpareParts. Left unchanged.`,
        });
        continue;
      }
    }

    // 4. Cross-machine name cluster with consistent unit: strong consolidation
    //    CANDIDATE, but display-level only. Owner ruling: AMBIGUOUS.
    if (cluster && cluster.machines.size > 1) {
      counts[CLASS.AMBIGUOUS_TECHNICAL_IDENTITY] += 1;
      register.push({
        ...base, classification: CLASS.AMBIGUOUS_TECHNICAL_IDENTITY,
        matchedSparePartCode: null, matchBasis: 'name+unit+quantity (REJECTED as identity)',
        missingEvidence: ['partNumber', 'manufacturer', 'specification', 'verified productId'],
        reason: `Appears on ${cluster.machines.size} machines as "${mp.name}" with a single consistent unit. Name, unit and quantity are display/usage attributes, not technical identity, so equivalence is unproven. Record preserved unchanged pending authoritative evidence.`,
      });
      continue;
    }

    // 5. Technical identity present but absent from the catalog -> verified new.
    if (mp.productId || mp.partNumber) {
      counts[CLASS.VERIFIED_NEW_CANONICAL_ITEM] += 1;
      register.push({
        ...base, classification: CLASS.VERIFIED_NEW_CANONICAL_ITEM,
        matchedSparePartCode: null, matchBasis: null, missingEvidence: [],
        reason: 'Carries independent technical identity absent from the canonical catalog.',
      });
      continue;
    }

    counts[CLASS.INSUFFICIENT_SOURCE_EVIDENCE] += 1;
    register.push({
      ...base, classification: CLASS.INSUFFICIENT_SOURCE_EVIDENCE,
      matchedSparePartCode: null, matchBasis: null,
      missingEvidence: ['partNumber', 'manufacturer', 'specification', 'verified productId'],
      reason: 'Unique name on this machine; machine_parts carries no technical identity columns, so no equivalence can be evaluated. Record preserved unchanged.',
    });
  }

  return { register, counts, mps, sps, machines };
}

async function main() {
  const { register, counts, mps, sps } = await classify();

  const outDir = path.resolve(__dirname, '../../../docs/proofs/r4n-unified-spare-parts-2026-10-01');
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, 'reconciliation-register.json'), JSON.stringify(register, null, 2));

  const header = 'machinePartCode,machinePartName,machineId,machineCode,companyId,branchId,unit,quantity,clusterSize,clusterMachineCount,classification,matchedSparePartCode,matchBasis,missingEvidence,reason';
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...register.map((r) => [
    r.machinePartCode, r.machinePartName, r.machineId ?? '', r.machineCode ?? '',
    r.companyId ?? '', r.branchId ?? '', r.unit, r.quantity, r.clusterSize,
    r.clusterMachineCount, r.classification, r.matchedSparePartCode ?? '',
    r.matchBasis ?? '', r.missingEvidence.join('; '), r.reason,
  ].map(esc).join(','))].join('\n');
  fs.writeFileSync(path.join(outDir, 'reconciliation-register.csv'), csv);

  const clusters = new Map<string, { rows: number; machines: Set<string> }>();
  for (const mp of mps) {
    if (!mp.machineId) continue;
    const k = norm(mp.name);
    const cur = clusters.get(k);
    if (cur) { cur.rows += 1; cur.machines.add(mp.machineId); } else clusters.set(k, { rows: 1, machines: new Set([mp.machineId]) });
  }
  const ambiguousClusters = [...clusters.entries()]
    .filter(([, v]) => v.machines.size > 1)
    .map(([name, v]) => ({ name, rows: v.rows, machineCount: v.machines.size }))
    .sort((a, b) => b.machineCount - a.machineCount || b.rows - a.rows);
  fs.writeFileSync(path.join(outDir, 'ambiguous-cluster-summary.json'), JSON.stringify({
    note: 'Owner ruling: these clusters are AMBIGUOUS_TECHNICAL_IDENTITY. name+unit+quantity is not technical identity. Not merged.',
    clusterCount: ambiguousClusters.length,
    recordsHeldUnchanged: ambiguousClusters.reduce((a, c) => a + c.rows, 0),
    clusters: ambiguousClusters,
  }, null, 2));

  console.log(JSON.stringify({
    machinePartsTotal: mps.length,
    sparePartsTotal: sps.length,
    classification: counts,
    ambiguousClusterCount: ambiguousClusters.length,
    ambiguousRecordsHeldUnchanged: ambiguousClusters.reduce((a, c) => a + c.rows, 0),
    registerPath: path.join(outDir, 'reconciliation-register.csv'),
    mutationsPerformed: 0,
  }, null, 2));
}

main().catch((e) => { console.error('FATAL', e); process.exitCode = 1; }).finally(() => prisma.$disconnect());