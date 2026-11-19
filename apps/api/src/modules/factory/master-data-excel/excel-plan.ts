import { createHash } from 'node:crypto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { evaluateProductCanonicalIdentity, PRODUCT_VERDICT_UNIQUE } from '../../../common/canonical-identity/canonical-product-identity';
import { evaluateSparePartCanonicalIdentity, CANONICAL_VERDICT_UNIQUE } from '../../../common/canonical-identity/canonical-spare-part-identity';
import { canonicalDate } from '../../../common/excel/excel-parser';
import { excelFailure } from '../../../common/excel/excel-zip';
import { EXCEL_LIMITS, ExcelDefinition, ExcelPreviewRow, ExcelRowError, ParsedExcel } from '../../../common/excel/excel.types';

export type ExcelImportMode = 'CREATE_ONLY' | 'UPDATE_EXISTING' | 'CREATE_AND_UPDATE';
export interface PlannedExcelRow extends ExcelPreviewRow { key: string; dto: Record<string, any>; existing?: any; parentKey?: string; fingerprint: string; }
export interface ExcelPlan { rows: PlannedExcelRow[]; ordered: PlannedExcelRow[]; fingerprint: string; errors: ExcelRowError[]; existingIds: Map<string, string>; }
export const businessKey = (value: unknown) => String(value ?? '').trim().normalize('NFC').toUpperCase();
export const tenantMachineScope = (ctx: ActiveOperationalContext) => ({ companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] });
/** `ProductionLine.branchId` is a required FK, so Prisma rejects `branchId: null` inside a filter. */
export const tenantRequiredBranchScope = (ctx: ActiveOperationalContext) => ({ companyId: ctx.companyId, branchId: ctx.branchId });
export function digest(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

const MULTI_DELIMITER = ';';
/** Flat-sheet attributes resolved explicitly into machineIds/machineData; never forwarded to the DTO. */
const COMPONENT_VIRTUAL_FIELDS = new Set(['machineCodes', 'machineCode', 'locationsInMachine', 'serialNumbers', 'legacyLocationInMachine', 'legacySerialNumber']);

function splitDelimited(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value);
  if (!text.trim()) return undefined;
  return text.split(MULTI_DELIMITER).map(part => part.trim());
}

const includes = (def: ExcelDefinition): any => def.model === 'machine' ? { category: true, department: true, productionLine: true, operationType: true, defaultCostCenter: true } : def.model === 'machineComponent' ? {
  // Legacy primary pointer is kept only for historic single-machine rows.
  machine: { select: { id: true, code: true, companyId: true, branchId: true } },
  machineLinks: {
    where: { status: 'ACTIVE' },
    select: { machineId: true, status: true, locationInMachine: true, serialNumber: true, machine: { select: { id: true, code: true } } },
  },
  parentComponent: { select: { code: true } },
} : def.model === 'product' ? { category: true, unitRef: true } : { product: true, unitRef: true };
export { includes as excelIncludes };

/** Pure read planning. The same function runs again on the Serializable transaction client. */
export async function buildExcelPlan(db: any, def: ExcelDefinition, parsed: ParsedExcel, mode: ExcelImportMode, ctx: ActiveOperationalContext): Promise<ExcelPlan> {
  const isComponent = def.model === 'machineComponent';
  const codes = [...new Set(parsed.rows.map(r => String(r.values.Code || '')).filter(Boolean))];
  const scope = tenantMachineScope(ctx);
  const where: any = { code: { in: codes } };
  if (def.model === 'machine') where.AND = [scope];
  // Components are now tenant-owned logical records; never resolve them by a
  // composite machine+code key and never fetch a foreign record by code alone.
  if (isComponent) where.AND = [scope];
  const records: any[] = codes.length ? await db[def.model].findMany({ where, include: includes(def), take: EXCEL_LIMITS.exportRows + 1, orderBy: { id: 'asc' } }) : [];
  if (records.length > EXCEL_LIMITS.exportRows) throw excelFailure('excelReferenceLimit');
  // Machine codes have a global DB constraint. Probe only caller-supplied codes,
  // never foreign names/IDs, so unavailable identities cannot become accidental creates.
  const foreign: any[] = def.model === 'machine' && codes.length ? await db.machine.findMany({ where: { code: { in: codes }, NOT: scope }, select: { code: true }, take: EXCEL_LIMITS.importRows + 1 }) : [];
  const foreignCodes = new Set(foreign.map(r => businessKey(r.code)));
  const key = (r: any) => businessKey(r.code);
  const byKey = new Map(records.map(r => [key(r), r]));

  // Resolve MachineCodes (or legacy MachineCode) only inside the active tenant
  // and branch. Unknown, inactive, soft-deleted and foreign codes are rejected.
  const machineIndex = new Map<string, any>();
  let machineState: any[] = [];
  if (isComponent) {
    const wanted: string[] = [], seenWanted = new Set<string>();
    for (const row of parsed.rows) {
      const supplied = splitDelimited(row.values.MachineCodes)
        ?? (row.values.MachineCode !== undefined ? [String(row.values.MachineCode)] : undefined);
      for (const code of supplied ?? []) {
        const trimmed = code.trim();
        if (!trimmed) continue;
        const normalized = businessKey(trimmed);
        if (seenWanted.has(normalized)) continue;
        seenWanted.add(normalized);
        wanted.push(trimmed);
      }
    }
    if (wanted.length) {
      machineState = await db.machine.findMany({
        where: { code: { in: wanted }, AND: [scope], deletedAt: null, status: 'ACTIVE' },
        select: { id: true, code: true },
        take: EXCEL_LIMITS.exportRows + 1,
        orderBy: { id: 'asc' },
      });
      if (machineState.length > EXCEL_LIMITS.exportRows) throw excelFailure('excelReferenceLimit');
      for (const match of machineState) {
        const normalized = businessKey(match.code);
        machineIndex.set(normalized, machineIndex.has(normalized) ? null : match);
      }
    }
  }

  const refs = new Map<string, Map<string, any>>(), refState: unknown[] = [];
  for (const column of def.columns) {
    if (!column.reference || column.reference === 'parentComponent') continue;
    const wanted = [...new Set(parsed.rows.map(r => String(r.values[column.header] || '')).filter(Boolean))];
    if (!wanted.length) { refs.set(column.header, new Map()); continue; }
    const model = column.reference;
    const referenceWhere: any = { code: { in: wanted }, ...(model === 'unit' ? { isActive: true } : { deletedAt: null, status: 'ACTIVE' }) };
    if (['machine', 'department', 'productionLine'].includes(model)) referenceWhere.AND = [model === 'productionLine' ? tenantRequiredBranchScope(ctx) : scope];
    const matches: any[] = await db[model].findMany({ where: referenceWhere, take: EXCEL_LIMITS.exportRows + 1, orderBy: { id: 'asc' } });
    if (matches.length > EXCEL_LIMITS.exportRows) throw excelFailure('excelReferenceLimit');
    const index = new Map<string, any>();
    for (const match of matches) { const k = businessKey(match.code); index.set(k, index.has(k) ? null : match); }
    refs.set(column.header, index); refState.push([column.header, matches]);
  }
  refState.push(['machineCodes', machineState]);

  const parentCodes = [...new Set(parsed.rows.map(r => String(r.values.ParentComponentCode || '')).filter(Boolean))];
  const graphCodes = [...new Set([...codes, ...parentCodes])];
  const graphRecords: any[] = isComponent && graphCodes.length ? await db.machineComponent.findMany({
    where: { deletedAt: null, code: { in: graphCodes }, AND: [scope] }, include: includes(def), take: EXCEL_LIMITS.exportRows + 1, orderBy: { id: 'asc' },
  }) : [];
  if (graphRecords.length > EXCEL_LIMITS.exportRows) throw excelFailure('excelReferenceLimit');

  const rows: PlannedExcelRow[] = parsed.rows.map(input => {
    const values = { ...input.values }, k = businessKey(values.Code), existing = byKey.get(k);
    const row: PlannedExcelRow = { row: input.row, values, code: String(existing?.code || values.Code || ''), name: String(values.Name || existing?.name || ''), key: k, dto: {}, existing, errors: [...input.errors], action: existing ? 'UPDATE' : 'NEW', fingerprint: '' };
    const error = (column: string, code: string) => row.errors.push({ row: row.row, column, code: `validation.${code}`, value: String(values[column] ?? '').slice(0, 100) });
    if (existing?.deletedAt || foreignCodes.has(k)) { error('Code', 'excelKeyUnavailable'); row.action = 'CONFLICT_EXISTING'; }
    if (mode === 'CREATE_ONLY' && existing) { error('Code', 'excelExisting'); row.action = 'CONFLICT_EXISTING'; }
    if (mode === 'UPDATE_EXISTING' && !existing) error('Code', 'excelUnknownKey');
    let changed = false;
    for (const column of def.columns) {
      if (!column.importable || (isComponent && COMPONENT_VIRTUAL_FIELDS.has(column.field))) continue;
      const value = values[column.header];
      if (value === undefined) {
        if (column.required === 'identity' || (!existing && column.required === 'create')) error(column.header, 'excelRequired');
        continue;
      }
      if (column.reference === 'parentComponent') { row.parentKey = businessKey(value); continue; }
      let resolved: any = value;
      if (column.reference) {
        let reference = refs.get(column.header)?.get(businessKey(value));
        // An unchanged global reference may be historical/inactive. Never use
        // this exception for tenant-owned references or for re-pointing.
        const relation = column.field === 'unitId' ? existing?.unitRef : column.field === 'categoryId' ? existing?.category : column.field === 'productId' ? existing?.product : column.field === 'operationTypeId' ? existing?.operationType : undefined;
        if (!reference && ['unit', 'machineCategory', 'productCategory', 'operationType', 'product'].includes(column.reference) && relation && businessKey(relation.code) === businessKey(value)) reference = relation;
        if (!reference) { error(column.header, 'excelReference'); continue; }
        resolved = reference.id;
      }
      const stored = column.field === 'costCenterName' ? existing?.defaultCostCenter?.name : column.field === 'costCenterType' ? existing?.defaultCostCenter?.type : existing?.[column.field];
      const previous = column.type === 'date' && stored ? canonicalDate(stored) : stored;
      if (existing && !column.update && column.required !== 'identity') {
        if ((previous ?? null) !== resolved) error(column.header, 'excelImmutable');
        continue;
      }
      if (column.required === 'identity' && existing) resolved = column.field === 'code' ? existing.code : existing[column.field];
      if (!existing || column.required === 'identity' || (previous ?? null) !== resolved) row.dto[column.field] = resolved;
      if (existing && column.update && (previous ?? null) !== resolved) changed = true;
    }

    if (isComponent) {
      const hasMulti = values.MachineCodes !== undefined && String(values.MachineCodes).trim().length > 0;
      const sourceHeader = hasMulti ? 'MachineCodes' : 'MachineCode';
      const rawParts = hasMulti ? splitDelimited(values.MachineCodes) : (values.MachineCode !== undefined ? splitDelimited(values.MachineCode) : undefined);
      if (!rawParts?.length) error(sourceHeader, 'excelRequired');
      const codeParts = rawParts ?? [];
      const seen = new Set<string>();
      const selected: Array<{ index: number; key: string }> = [];
      codeParts.forEach((code, index) => {
        const normalized = businessKey(code);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        selected.push({ index, key: normalized });
      });
      const locParts = splitDelimited(values.LocationsInMachine);
      const serParts = splitDelimited(values.SerialNumbers);
      if (locParts && locParts.length !== codeParts.length) error('LocationsInMachine', 'excelReference');
      if (serParts && serParts.length !== codeParts.length) error('SerialNumbers', 'excelReference');
      // Legacy headers are keyed by header name in parsed values, not by virtual field name.
      const legacyLoc = values.LocationInMachine, legacySer = values.SerialNumber;
      if (selected.length > 1 && (legacyLoc !== undefined || legacySer !== undefined) && (!locParts || !serParts)) {
        if (legacyLoc !== undefined) error('LocationInMachine', 'excelReference');
        if (legacySer !== undefined) error('SerialNumber', 'excelReference');
      }
      const machineIds: string[] = [];
      const machineData: Array<{ machineId: string; locationInMachine: string | null; serialNumber: string | null }> = [];
      for (const entry of selected) {
        const machine = machineIndex.get(entry.key);
        if (!machine) { error(sourceHeader, 'excelReference'); continue; }
        if (!machineIds.includes(machine.id)) machineIds.push(machine.id);
        if (machineData.some(data => data.machineId === machine.id)) continue;
        const location = locParts?.[entry.index] ?? (selected.length === 1 && legacyLoc !== undefined ? String(legacyLoc) : '');
        const serial = serParts?.[entry.index] ?? (selected.length === 1 && legacySer !== undefined ? String(legacySer) : '');
        machineData.push({ machineId: machine.id, locationInMachine: location || null, serialNumber: serial || null });
      }
      row.dto.machineIds = machineIds;
      if (machineData.length) row.dto.machineData = machineData;
      if (!existing && !machineIds.length) error(sourceHeader, 'excelRequired');
      const links: any[] = (existing?.machineLinks ?? []).filter((link: any) => link.status === 'ACTIVE');
      const currentIds = links.map(link => link.machineId);
      const sameSet = currentIds.length === machineIds.length && machineIds.every(id => currentIds.includes(id));
      const sameData = sameSet && machineIds.every(id => {
        const before = links.find(link => link.machineId === id);
        const after = machineData.find(data => data.machineId === id);
        return (before?.locationInMachine ?? null) === (after?.locationInMachine ?? null) && (before?.serialNumber ?? null) === (after?.serialNumber ?? null);
      });
      if (existing && !sameData) changed = true;
    }

    if (!existing && def.model === 'machine') row.dto.dedicatedCostCenter = { name: row.dto.costCenterName || row.dto.name, type: row.dto.costCenterType };
    delete row.dto.costCenterName; delete row.dto.costCenterType;
    if (def.model === 'machine' && (row.dto.productionLineId || row.dto.departmentId)) {
      const line = row.dto.productionLineId ? refs.get('ProductionLineCode')?.get(businessKey(values.ProductionLineCode)) : existing?.productionLine;
      const departmentId = row.dto.departmentId ?? existing?.departmentId;
      if (line && (line.companyId !== ctx.companyId || line.branchId !== ctx.branchId || (departmentId && line.departmentId !== departmentId) || (existing?.administrationId && line.administrationId && existing.administrationId !== line.administrationId))) error('ProductionLineCode', 'excelReference');
    }
    if (!existing && row.dto.unitId) row.dto.unit = refs.get('UnitCode')?.get(businessKey(values.UnitCode))?.code;
    if (existing && !changed && row.parentKey === undefined) row.action = row.action === 'CONFLICT_EXISTING' ? row.action : 'UNCHANGED';
    return row;
  });
  const duplicates = new Map<string, PlannedExcelRow[]>();
  for (const row of rows) { const list = duplicates.get(row.key) || []; list.push(row); duplicates.set(row.key, list); }
  for (const list of duplicates.values()) if (list.length > 1) for (const row of list) { row.action = 'DUPLICATE_IN_FILE'; row.errors.push({ row: row.row, column: 'Code', code: 'validation.excelDuplicate' }); }

  const machinesUnchanged = (row: PlannedExcelRow) => {
    const links: any[] = (row.existing?.machineLinks ?? []).filter((link: any) => link.status === 'ACTIVE');
    const ids = links.map(link => link.machineId), desired: string[] = row.dto.machineIds ?? [];
    return ids.length === desired.length && desired.every(id => {
      const before = links.find(link => link.machineId === id);
      const after = (row.dto.machineData ?? []).find((data: any) => data.machineId === id);
      return !!before && !!after && (before.locationInMachine ?? null) === (after.locationInMachine ?? null) && (before.serialNumber ?? null) === (after.serialNumber ?? null);
    });
  };
  const graph = new Map<string, string | undefined>(), graphById = new Map(graphRecords.map(r => [r.id, r]));
  for (const r of graphRecords) graph.set(key(r), r.parentComponentId ? (graphById.has(r.parentComponentId) ? key(graphById.get(r.parentComponentId)) : '__invalid_parent__') : undefined);
  for (const row of rows) if (isComponent) {
    if (row.parentKey !== undefined) {
      if (row.parentKey === row.key) row.errors.push({ row: row.row, column: 'ParentComponentCode', code: 'validation.excelCycle' });
      if (!graph.has(row.parentKey) && !rows.some(r => r.key === row.parentKey)) row.errors.push({ row: row.row, column: 'ParentComponentCode', code: 'validation.excelReference' });
      const existingParent = row.existing?.parentComponentId ? graphById.get(row.existing.parentComponentId) : undefined;
      if (row.action === 'UPDATE' && existingParent && key(existingParent) === row.parentKey && machinesUnchanged(row)
        && !Object.entries(row.dto).some(([field, value]) => !['code', 'machineIds', 'machineData'].includes(field) && row.existing[field] !== value)) row.action = 'UNCHANGED';
      graph.set(row.key, row.parentKey);
    } else if (!graph.has(row.key)) graph.set(row.key, undefined);
  }
  for (const row of rows) if (isComponent) {
    const seen = new Set<string>(); let current: string | undefined = row.key;
    while (current) { if (seen.has(current)) { row.errors.push({ row: row.row, column: 'ParentComponentCode', code: 'validation.excelCycle' }); break; } seen.add(current); if (current === '__invalid_parent__') { row.errors.push({ row: row.row, column: 'ParentComponentCode', code: 'validation.excelReference' }); break; } current = graph.get(current); }
  }
  // Use the existing canonical identity policies, never a fuzzy name match.
  if (def.model === 'product' || def.model === 'sparePart') {
    const merged = rows.map(r => ({ ...r.existing, ...r.dto, id: r.existing?.id || `excel-row-${r.row}`, code: r.code, name: r.name }));
    const fields = def.model === 'product' ? ['code', 'barcode'] : ['manufacturer', 'partNumber', 'productId', 'model', 'specification'];
    const alternatives: any[] = [];
    for (const field of fields) { const values = [...new Set(merged.map(r => r[field]).filter(Boolean))]; if (values.length) alternatives.push({ [field]: { in: values } }); }
    const candidates: any[] = alternatives.length ? await db[def.model].findMany({ where: { deletedAt: null, OR: alternatives }, take: EXCEL_LIMITS.exportRows + 1, orderBy: { id: 'asc' } }) : [];
    if (candidates.length > EXCEL_LIMITS.exportRows) throw excelFailure('excelReferenceLimit');
    refState.push(['canonicalIdentity', candidates]);
    rows.forEach((row, index) => {
      const state = merged[index], others = [...candidates.filter(c => c.id !== row.existing?.id), ...merged.filter((_, i) => i !== index)];
      const decisions = def.model === 'product' ? [evaluateProductCanonicalIdentity({ code: state.code }, others), evaluateProductCanonicalIdentity({ barcode: state.barcode }, others)] : [evaluateSparePartCanonicalIdentity(state, others)];
      const linkedProductConflict = def.model === 'sparePart' && state.productId && others.some(other => other.productId === state.productId);
      if (linkedProductConflict || decisions.some(decision => decision.verdict !== (def.model === 'product' ? PRODUCT_VERDICT_UNIQUE : CANONICAL_VERDICT_UNIQUE))) row.errors.push({ row: row.row, column: def.model === 'product' ? 'Barcode' : 'PartNumber', code: 'validation.excelIdentityConflict' });
    });
  }
  for (const row of rows) { if (row.errors.length && !['DUPLICATE_IN_FILE', 'CONFLICT_EXISTING'].includes(row.action)) row.action = 'INVALID'; row.fingerprint = digest([row.existing || null, row.dto, row.parentKey || null]); }
  const ordered: PlannedExcelRow[] = [], visited = new Set<string>(), visiting = new Set<string>(), rowByKey = new Map(rows.map(r => [r.key, r]));
  const visit = (row: PlannedExcelRow) => { if (visited.has(row.key) || visiting.has(row.key)) return; visiting.add(row.key); if (row.parentKey && rowByKey.has(row.parentKey)) visit(rowByKey.get(row.parentKey)!); visiting.delete(row.key); visited.add(row.key); ordered.push(row); };
  rows.forEach(visit);
  return { rows, ordered, fingerprint: digest([rows.map(r => [r.key, r.fingerprint, r.action, r.errors]), refState, graphRecords]), errors: rows.flatMap(r => r.errors), existingIds: new Map(records.map(r => [key(r), r.id])) };
}
