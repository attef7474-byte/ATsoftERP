import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ExcelJS from 'exceljs';
import { PermissionCheckService } from '../../../common/rbac/permission-check.service';
import { MasterDataExcelService } from './master-data-excel.service';
import { GOVERNANCE_EXCEL_ADAPTERS } from './governance-export.definitions';

const REPO = path.resolve(__dirname, '../../../../../..');
const ctx: any = { companyId: 'A', branchId: 'A1', companyCode: 'A', companyName: 'Company A', branchCode: 'A1', branchName: 'Branch A1' };

function harness(model: string, permission: string, rows: any[] = [], permissions: string[] = [permission]) {
  const findMany = jest.fn(async () => rows);
  const db: any = {
    userRole: { findMany: jest.fn(async () => [{ role: { code: 'AUDITOR', status: 'ACTIVE', permissions: permissions.map(key => ({ permission: { key, status: 'ACTIVE' } })) } }]) },
    user: { findUnique: jest.fn(async () => ({ name: 'Auditor' })) },
    [model]: { findMany },
  };
  const audit = { logWithClient: jest.fn(async () => undefined) };
  const service = new MasterDataExcelService(db, new PermissionCheckService(db), audit as any, {} as any, {} as any, {} as any, {} as any);
  return { service, db, audit, findMany };
}

async function readWorkbook(buffer: Buffer) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer as any);
  return book;
}

/**
 * Rebuild the exact set of permission keys the seed scripts declare. Keys are
 * seeded either as quoted literals or through the `MODULES x ACTIONS` template,
 * so both forms are collected. This is the same authority the running system
 * uses; a key absent here would be permanently 403 for every non-SUPER_ADMIN.
 */
function seededPermissionKeys(): Set<string> {
  const seedDir = path.join(REPO, 'apps/api/prisma/seed');
  const srcDir = path.join(REPO, 'apps/api/src');
  const seeded = new Set<string>();
  const keyLike = /^[a-z][\w-]*[.:][\w.:-]+$/i;
  const collectLiterals = (text: string) => {
    for (const literal of text.matchAll(/['"]([^'"`]+)['"]/g)) {
      if (keyLike.test(literal[1])) seeded.add(literal[1]);
    }
  };
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      // Keys are declared in seed scripts and in the *constants/*permission*
      // modules they import; both are needed to reconstruct the seeded set.
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
        && (/constants|permission/i.test(entry.name) || dir === seedDir)) collectLiterals(fs.readFileSync(full, 'utf8'));
    }
  };
  walk(seedDir);
  walk(srcDir);
  const seedText = fs.readFileSync(path.join(seedDir, 'seed.ts'), 'utf8');
  const modulesBlock = seedText.match(/const MODULES = \[([\s\S]*?)\] as const;/);
  if (modulesBlock) {
    const modules = [...modulesBlock[1].matchAll(/"([^"]+)"/g)].map(match => match[1]);
    const actionsBlock = seedText.match(/const ACTIONS = \[([\s\S]*?)\] as const;/);
    const actions = actionsBlock ? [...actionsBlock[1].matchAll(/"([^"]+)"/g)].map(match => match[1]) : ['create', 'read', 'update', 'delete'];
    for (const module of modules) for (const action of actions) seeded.add(`${module}:${action}`);
  }
  return seeded;
}

describe('governance Excel export adapters', () => {
  it('registers one real adapter for each non-report gap route', () => {
    const register = fs.readFileSync(path.join(REPO, 'docs/governance/EXCEL_COVERAGE_REGISTER.md'), 'utf8');
    const registeredRoutes = new Set([...register.matchAll(/^\|\s*\d+\s*\|\s*`([^`]+)`\s*\|/gm)].map(match => match[1]));
    const defined = Object.values(GOVERNANCE_EXCEL_ADAPTERS).map(definition => definition.route);
    expect(defined).toHaveLength(74);
    expect(new Set(defined).size).toBe(74);
    for (const route of defined) expect(registeredRoutes.has(route!)).toBe(true);
  });

  it('uses only real Prisma models, fields, relation roots and seeded permission keys', () => {
    const schema = fs.readFileSync(path.join(REPO, 'apps/api/prisma/schema.prisma'), 'utf8');
    const seeded = seededPermissionKeys();
    const models = new Map<string, Set<string>>();
    for (const match of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
      const fields = new Set<string>();
      for (const line of match[2].split('\n')) {
        const field = line.match(/^\s{2,6}([A-Za-z_]\w*)\s+\S/);
        if (field) fields.add(field[1]);
      }
      models.set(match[1], fields);
    }
    for (const definition of Object.values(GOVERNANCE_EXCEL_ADAPTERS)) {
      const modelName = definition.model[0].toUpperCase() + definition.model.slice(1);
      const fields = models.get(modelName);
      expect(fields).toBeDefined();
      expect(definition.exportOnly).toBe(true);
      expect(definition.permission).toMatch(/^[\w.:-]+$/);
      expect(seeded.has(definition.permission)).toBe(true);
      for (const column of definition.columns) {
        expect(fields!.has(column.field)).toBe(true);
      }
      for (const scopeField of [definition.scope?.companyField, definition.scope?.branchField]) {
        if (!scopeField || scopeField === 'id') continue;
        expect(fields!.has(scopeField.split('.')[0])).toBe(true);
      }
    }
  });

  it('keeps the web route map in exact parity with backend adapters', () => {
    const web = JSON.parse(fs.readFileSync(path.join(REPO, 'apps/web/src/lib/excel-governance-routes.json'), 'utf8')) as Array<{ route: string; entity: string; permission: string }>;
    expect(web).toHaveLength(74);
    for (const entry of web) {
      const definition = GOVERNANCE_EXCEL_ADAPTERS[entry.entity];
      expect(definition).toBeDefined();
      expect(definition.route).toBe(entry.route);
      expect(definition.permission).toBe(entry.permission);
    }
  });

  it('scopes tenant-owned exports, rejects the wrong tenant and audits EXCEL_EXPORT', async () => {
    const definition = GOVERNANCE_EXCEL_ADAPTERS['warehouses'];
    const h = harness(definition.model, definition.permission, [{ code: 'W1', name: 'Main', location: 'Site', warehouseType: 'RAW', status: 'ACTIVE', createdAt: new Date('2026-01-01T00:00:00Z') }]);
    const buffer = await h.service.export('warehouses', 'u', ctx, 'en');
    expect(h.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { AND: [{ deletedAt: null }, { companyId: 'A' }, { branchId: 'A1' }] }, take: 5001 }));
    expect(h.audit.logWithClient).toHaveBeenCalledWith(h.db, expect.objectContaining({ action: 'EXCEL_EXPORT', entity: 'warehouse', details: expect.objectContaining({ companyId: 'A', branchId: 'A1', route: definition.route, rowCount: 1 }) }));
    const book = await readWorkbook(buffer);
    expect(book.getWorksheet('Data')!.getRow(1).values).toEqual([undefined, 'Code', 'Name', 'Location', 'WarehouseType', 'Status', 'CreatedAt']);
    expect(book.getWorksheet('Instructions')!.getCell('B2').value).toBe('Warehouses');
  });

  it('supports nested relation scoping and global system catalogues', async () => {
    const nested = harness('warehouseLocation', GOVERNANCE_EXCEL_ADAPTERS['warehouse-locations'].permission);
    await nested.service.export('warehouse-locations', 'u', ctx, 'en');
    const nestedWhere = (nested.findMany.mock.calls as any[][])[0][0].where;
    expect(nestedWhere.AND).toEqual([{ warehouse: { companyId: 'A' } }, { warehouse: { branchId: 'A1' } }]);

    const global = harness('unit', GOVERNANCE_EXCEL_ADAPTERS['units'].permission);
    await global.service.export('units', 'u', ctx, 'ar');
    const globalWhere = (global.findMany.mock.calls as any[][])[0][0].where;
    expect(globalWhere).toEqual({});
  });

  it('refuses all write paths for export-only adapters', async () => {
    const definition = GOVERNANCE_EXCEL_ADAPTERS['companies'];
    const h = harness(definition.model, definition.permission);
    const upload: any = { buffer: Buffer.from('x'), originalname: 'x.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 1 };
    await expect(h.service.template('companies', 'u', ctx, 'en')).rejects.toMatchObject({ status: 403 });
    await expect(h.service.validate('companies', upload, 'CREATE_ONLY', 'u', ctx)).rejects.toMatchObject({ status: 403 });
    await expect(h.service.errors('companies', upload, 'CREATE_ONLY', 'u', ctx, 'en')).rejects.toMatchObject({ status: 403 });
    await expect(h.service.import('companies', upload, 'CREATE_ONLY', 'token', 'u', ctx)).rejects.toMatchObject({ status: 403 });
    expect(h.findMany).not.toHaveBeenCalled();
  });

  it('denies export without the real read permission and never leaks script cells', async () => {
    const definition = GOVERNANCE_EXCEL_ADAPTERS['notifications'];
    const denied = harness(definition.model, definition.permission, [], []);
    await expect(denied.service.export('notifications', 'u', ctx, 'en')).rejects.toMatchObject({ status: 403 });

    const h = harness(definition.model, definition.permission, [{ title: '=1+1', message: '+SUM(A1)', type: 'INFO', read: false, link: '@cmd', createdAt: new Date('2026-01-01T00:00:00Z') }]);
    const book = await readWorkbook(await h.service.export('notifications', 'u', ctx, 'en'));
    const sheet = book.getWorksheet('Data')!;
    for (let column = 1; column <= 6; column++) {
      const cell = sheet.getCell(2, column);
      expect(cell.value).not.toHaveProperty('formula');
      expect(cell.value).not.toHaveProperty('sharedFormula');
    }
    // Script-prefixed text is preserved verbatim as a string cell, never executed.
    expect(sheet.getCell(2, 1).value).toBe('=1+1');
    expect(sheet.getCell(2, 2).value).toBe('+SUM(A1)');
    expect(sheet.getCell(2, 5).value).toBe('@cmd');
  });
});
