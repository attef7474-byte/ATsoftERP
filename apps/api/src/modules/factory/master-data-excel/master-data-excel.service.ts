import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PermissionCheckService } from '../../../common/rbac/permission-check.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { EXCEL_LIMITS, ExcelDefinition, ExcelImportResult, ExcelPreviewRow } from '../../../common/excel/excel.types';
import { ExcelUpload, parseExcel, canonicalDate } from '../../../common/excel/excel-parser';
import { excelFailure } from '../../../common/excel/excel-zip';
import { buildExcelWorkbook } from '../../../common/excel/excel-workbook';
import { EXCEL_DEFINITIONS } from './excel.definitions';
import { buildExcelPlan, digest, ExcelImportMode, excelIncludes, tenantMachineScope } from './excel-plan';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { MachineComponentsService } from '../maintenance/machine-components/machine-components.service';
import { SparePartsService } from '../maintenance/spare-parts/spare-parts.service';
import { ProductsService } from '../products/products.service';

interface Session { user: string; context: string; entity: string; mode: ExcelImportMode; hash: string; fingerprint: string; expires: number; busy: boolean; result?: ExcelImportResult; }
const conflict = (key: string) => new ConflictException({ messageKey: `validation.${key}` });
@Injectable()
export class MasterDataExcelService {
  private readonly sessions = new Map<string, Session>();
  private readonly validating = new Set<string>();
  constructor(private readonly db: PrismaService, private readonly permissions: PermissionCheckService, private readonly audit: AuditService,
    private readonly machines: MaintenanceService, private readonly components: MachineComponentsService,
    private readonly spares: SparePartsService, private readonly products: ProductsService) {}

  private async authorize(entity: string, user: string, ctx: ActiveOperationalContext, mode?: ExcelImportMode): Promise<ExcelDefinition> {
    const def = EXCEL_DEFINITIONS[entity as keyof typeof EXCEL_DEFINITIONS];
    if (!def) throw excelFailure('excelEntity');
    if (!ctx?.companyId || !ctx?.branchId) throw new ForbiddenException({ messageKey: 'validation.excelContext' });
    if (mode && ctx.isArchived) throw new ForbiddenException({ messageKey: 'validation.excelArchive' });
    const actions = ['read', ...(mode === 'CREATE_ONLY' ? ['create'] : mode === 'UPDATE_EXISTING' ? ['update'] : mode ? ['create', 'update'] : [])];
    await this.permissions.assertAll(user, actions.map(a => `${def.permission}:${a}`));
    return def;
  }
  private contextKey(ctx: ActiveOperationalContext) { return digest([ctx.companyId, ctx.branchId, ctx.administrationId, ctx.departmentId, !!ctx.isArchived]); }
  private async workbookContext(ctx: ActiveOperationalContext, user: string, locale: 'ar' | 'en', search?: string) {
    const actor = await this.db.user.findUnique({ where: { id: user }, select: { name: true } });
    return { locale, company: `${ctx.companyCode} — ${ctx.companyName}`, branch: `${ctx.branchCode} — ${ctx.branchName}`, user: actor?.name || '', filters: search ? { Search: search } : undefined };
  }
  private publicRows(rows: ExcelPreviewRow[]): ExcelPreviewRow[] {
    return rows.map(({ row, code, name, action, values, errors }) => ({ row, code, name, action, values, errors }));
  }
  private result(rows: ExcelPreviewRow[], warnings: number): ExcelImportResult {
    return { totalRows: rows.length, created: rows.filter(r => r.action === 'NEW').length, updated: rows.filter(r => r.action === 'UPDATE').length,
      unchanged: rows.filter(r => r.action === 'UNCHANGED').length, skipped: 0, warnings, failed: rows.filter(r => r.errors.length).length, errors: rows.flatMap(r => r.errors) };
  }
  async template(entity: string, user: string, ctx: ActiveOperationalContext, locale: 'ar' | 'en') {
    const def = await this.authorize(entity, user, ctx);
    return buildExcelWorkbook(def, [], await this.workbookContext(ctx, user, locale));
  }
  async export(entity: string, user: string, ctx: ActiveOperationalContext, locale: 'ar' | 'en', search = '') {
    const def = await this.authorize(entity, user, ctx), clauses: any[] = [{ deletedAt: null }];
    if (def.model === 'machine') clauses.push(tenantMachineScope(ctx));
    // Components are directly tenant-owned logical records. Scope by their own
    // ownership fields so a shared component is exported exactly once.
    if (def.model === 'machineComponent') clauses.push(tenantMachineScope(ctx));
    const searchFields = ['code', 'name', ...(def.model === 'machine' ? ['serialNumber'] : def.model === 'sparePart' ? ['partNumber'] : def.model === 'product' ? ['barcode'] : [])];
    if (search) clauses.push({ OR: searchFields.map(field => ({ [field]: { contains: search } })) });
    const records = await (this.db[def.model] as any).findMany({ where: { AND: clauses }, include: excelIncludes(def), orderBy: { code: 'asc' }, take: EXCEL_LIMITS.exportRows + 1 });
    if (records.length > EXCEL_LIMITS.exportRows) throw excelFailure('excelExportLimit');
    const rows = records.map((record: any) => Object.fromEntries(def.columns.filter(c => c.export).map(c => {
      let value = record[c.field];
      if (c.reference) {
        const relation = c.reference === 'parentComponent' ? 'parentComponent' : c.field === 'machineId' ? 'machine' : c.field === 'unitId' ? 'unitRef' : c.field === 'categoryId' ? 'category' : c.field.replace(/Id$/, '');
        value = record[relation]?.code;
      }
      if (c.field === 'costCenterName') value = record.defaultCostCenter?.name;
      if (c.field === 'costCenterType') value = record.defaultCostCenter?.type;
      if (def.model === 'machineComponent') {
        // One logical row per component. Machine codes and their physical
        // attributes come from ACTIVE associations, positionally aligned.
        // Historic rows without links fall back to the legacy primary pointer.
        const activeLinks: any[] = (record.machineLinks ?? []).filter((link: any) => link.status === 'ACTIVE');
        const entries = activeLinks.length ? activeLinks : (record.machine?.code ? [{ machine: record.machine, locationInMachine: record.locationInMachine, serialNumber: record.serialNumber }] : []);
        if (c.field === 'machineCodes') value = entries.map((entry: any) => entry.machine?.code).filter(Boolean).join(';');
        if (c.field === 'locationsInMachine') value = entries.map((entry: any) => entry.locationInMachine ?? '').join(';');
        if (c.field === 'serialNumbers') value = entries.map((entry: any) => entry.serialNumber ?? '').join(';');
      }
      if (c.type === 'date' && value) value = canonicalDate(value);
      if (c.type === 'number' && value != null) value = Number(value);
      return [c.header, value ?? ''];
    })));
    return buildExcelWorkbook(def, rows, await this.workbookContext(ctx, user, locale, search));
  }
  async validate(entity: string, file: ExcelUpload, mode: ExcelImportMode, user: string, ctx: ActiveOperationalContext) {
    const def = await this.authorize(entity, user, ctx, mode);
    if (this.validating.has(user)) throw conflict('excelBusy');
    this.validating.add(user);
    try {
      const parsed = await parseExcel(file, def), plan = await buildExcelPlan(this.db, def, parsed, mode, ctx);
      const now = Date.now();
      for (const [key, session] of this.sessions) if (session.expires <= now && !session.busy) this.sessions.delete(key);
      const owned = [...this.sessions].filter(([, s]) => s.user === user && !s.busy);
      while (owned.length >= 3) this.sessions.delete(owned.shift()![0]);
      if (this.sessions.size >= EXCEL_LIMITS.sessions) throw conflict('excelBusy');
      const token = randomUUID(), expires = now + EXCEL_LIMITS.sessionMs;
      this.sessions.set(token, { user, context: this.contextKey(ctx), entity, mode, hash: digest(file.buffer), fingerprint: plan.fingerprint, expires, busy: false });
      return { token, expires: new Date(expires).toISOString(), rows: this.publicRows(plan.rows), warnings: parsed.warnings, summary: this.result(plan.rows, parsed.warnings.length), canImport: plan.errors.length === 0 && plan.rows.length > 0, sharedCatalog: def.shared };
    } finally { this.validating.delete(user); }
  }
  async errors(entity: string, file: ExcelUpload, mode: ExcelImportMode, user: string, ctx: ActiveOperationalContext, locale: 'ar' | 'en') {
    const def = await this.authorize(entity, user, ctx, mode), parsed = await parseExcel(file, def), plan = await buildExcelPlan(this.db, def, parsed, mode, ctx);
    return buildExcelWorkbook(def, plan.rows.map(r => r.values), await this.workbookContext(ctx, user, locale), this.publicRows(plan.rows));
  }
  async import(entity: string, file: ExcelUpload, mode: ExcelImportMode, token: string, user: string, ctx: ActiveOperationalContext): Promise<ExcelImportResult> {
    const def = await this.authorize(entity, user, ctx, mode), session = this.sessions.get(token);
    if (!session || session.expires <= Date.now() || session.user !== user || session.context !== this.contextKey(ctx) || session.entity !== entity || session.mode !== mode || session.hash !== digest(file?.buffer)) throw conflict('excelPreviewExpired');
    if (session.busy) throw conflict('excelBusy');
    if (session.result) return session.result;
    session.busy = true;
    try {
      const parsed = await parseExcel(file, def);
      const result = await this.db.$transaction(async tx => {
        const plan = await buildExcelPlan(tx, def, parsed, mode, ctx);
        if (plan.fingerprint !== session.fingerprint) throw conflict('excelStale');
        if (plan.errors.length || !plan.rows.length) throw excelFailure('excelInvalidRows');
        const ids = plan.existingIds;
        for (const row of plan.ordered) {
          if (row.action === 'UNCHANGED') continue;
          const dto = { ...row.dto }; let saved: any;
          if (def.model === 'machine') saved = row.existing ? await this.machines.updateMachineInTx(tx, row.existing.id, dto as any, user, ctx) : await this.machines.createMachineInTx(tx, dto as any, user, ctx);
          else if (def.model === 'machineComponent') {
            if (row.parentKey) { dto.parentComponentId = ids.get(row.parentKey); if (!dto.parentComponentId) throw excelFailure('excelReference'); }
            saved = await this.components.saveInTx(tx, dto, user, ctx, row.existing?.id);
          } else if (def.model === 'sparePart') saved = row.existing ? await this.spares.updateInTx(tx, row.existing.id, dto as any, row.existing, user) : await this.spares.createInTx(tx, dto as any, user);
          else saved = row.existing ? await this.products.updateInTx(tx, row.existing.id, dto as any, row.existing, user) : await this.products.createInTx(tx, dto as any, user, dto.code);
          ids.set(row.key, saved.id);
        }
        const summary = this.result(plan.rows, parsed.warnings.length);
        await this.audit.logWithClient(tx, { userId: user, action: 'EXCEL_IMPORT', entity: def.model, entityId: token, details: { companyId: ctx.companyId, branchId: ctx.branchId, sharedCatalog: def.shared, mode, fileHash: session.hash, summary } });
        return summary;
      }, { isolationLevel: 'Serializable', timeout: 60000, maxWait: 10000 });
      session.result = result; return result;
    } catch (error) {
      if (['P2002', 'P2034'].includes((error as any)?.code)) throw conflict('excelStale');
      throw error;
    } finally { session.busy = false; }
  }
}
