/* Reviewed migration proof. Windows-auth DDL is limited to an explicit disposable clone. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { PrismaMssql } = require('@prisma/adapter-mssql');
const database = process.env.PERSONNEL_PROOF_DATABASE;
assert.match(database || '', /^ATsoftERP_PERSONNEL_P34_[A-Za-z0-9_]+$/);
assert.match(process.env.DATABASE_URL || '', /;database=[^;]+/i);
process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/;database=[^;]+/i, `;database=${database}`);
const p = new PrismaClient({ adapter: new PrismaMssql(process.env.DATABASE_URL) });
const migration = '20261122010000_work_order_planning_foundation';
const sql = path.resolve(`apps/api/prisma/migrations/${migration}/migration.sql`);
const output = path.resolve('docs/proofs/personnel-maintenance-integrity-r1/phase-3-migration-proof.json');
const report = { database, migration, status: 'RUNNING', startedAt: new Date().toISOString(), productionDdl: false,
  migrationSha256: createHash('sha256').update(fs.readFileSync(sql)).digest('hex') };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
const quoted = name => `[${name.replace(/]/g, ']]')}]`;
async function main() {
  assert.equal((await p.$queryRawUnsafe('SELECT DB_NAME() AS name'))[0].name, database);
  const tables = await p.$queryRawUnsafe("SELECT t.name FROM sys.tables t WHERE SCHEMA_NAME(t.schema_id)='dbo' AND t.name NOT IN ('_prisma_migrations','maintenance_work_order_assignments') ORDER BY t.name");
  const columns = {};
  for (const table of tables) columns[table.name] = await p.$queryRawUnsafe(`SELECT c.name FROM sys.columns c JOIN sys.tables t ON c.object_id=t.object_id WHERE t.name=N'${table.name.replace(/'/g,"''")}' AND c.name<>N'warehouseId' ORDER BY c.column_id`);
  // Preserve all columns on every old table; omit only the newly added part column.
  columns.maintenance_work_orders = null;
  for (const table of tables) if (table.name !== 'maintenance_work_order_parts') columns[table.name] = null;
  async function snapshot() {
    const result = {};
    for (const table of tables) {
      const pk = await p.$queryRawUnsafe(`SELECT c.name FROM sys.indexes i JOIN sys.index_columns ic ON i.object_id=ic.object_id AND i.index_id=ic.index_id JOIN sys.columns c ON ic.object_id=c.object_id AND ic.column_id=c.column_id WHERE i.is_primary_key=1 AND OBJECT_NAME(i.object_id)=N'${table.name.replace(/'/g,"''")}' ORDER BY ic.key_ordinal`);
      const select = columns[table.name]?.map(column => quoted(column.name)).join(',') || '*';
      const rows = await p.$queryRawUnsafe(`SELECT (SELECT ${select} FROM dbo.${quoted(table.name)} ${pk.length ? 'ORDER BY '+pk.map(column=>quoted(column.name)).join(',') : ''} FOR JSON PATH, INCLUDE_NULL_VALUES) AS payload`);
      const json = rows.map(row => Object.values(row)[0]).join('');
      const count = await p.$queryRawUnsafe(`SELECT COUNT_BIG(*) AS n FROM dbo.${quoted(table.name)}`);
      result[table.name] = { count: Number(count[0].n), sha256: createHash('sha256').update(json).digest('hex') };
    }
    return result;
  }
  report.before = await snapshot();
  report.keyLengths = await p.$queryRawUnsafe('SELECT MAX(LEN(id)) AS workOrder, MAX(LEN(companyId)) AS company, MAX(LEN(branchId)) AS branch, MAX(LEN(assignedToId)) AS legacyUser FROM maintenance_work_orders');
  assert(Object.values(report.keyLengths[0]).every(length => length === null || length <= 100));
  const applied = await p.$queryRawUnsafe(`SELECT migration_name FROM _prisma_migrations WHERE migration_name=N'${migration}' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`);
  if (!applied.length) {
    const run = spawnSync('C:/Program Files/Microsoft SQL Server/Client SDK/ODBC/170/Tools/Binn/SQLCMD.EXE', ['-S', 'tcp:localhost,50079', '-E', '-C', '-I', '-d', database, '-b', '-i', sql], { windowsHide: true, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const cli = path.join(path.dirname(require.resolve('prisma/package.json')), 'build/index.js');
    const resolve = spawnSync(process.execPath, [cli, 'migrate', 'resolve', '--applied', migration, '--config', 'apps/api/prisma.config.ts'], { windowsHide: true, encoding: 'utf8', env: process.env });
    assert.equal(resolve.status, 0, resolve.stdout + resolve.stderr);
  }
  report.after = await snapshot(); assert.deepEqual(report.after, report.before);
  const state = await p.$queryRawUnsafe("SELECT (SELECT COUNT(*) FROM maintenance_work_order_assignments) assignments,(SELECT COUNT(*) FROM maintenance_work_order_parts WHERE warehouseId IS NOT NULL) mappedLegacyParts,(SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL) unfinished,(SELECT COUNT(*) FROM sys.indexes WHERE object_id=OBJECT_ID('maintenance_work_order_assignments') AND name='maintenance_work_order_assignments_active_key' AND is_unique=1 AND has_filter=1) activeUniqueIndex");
  assert.deepEqual(state[0], { assignments: 0, mappedLegacyParts: 0, unfinished: 0, activeUniqueIndex: 1 });
  report.state = state[0]; report.preservedTables = tables.length; report.status = 'PASS';
  console.log(`PASS migration, ledger, filtered uniqueness and ${tables.length} existing table content hashes`);
}
main().catch(error => { report.status = 'FAIL'; report.failure = error.message; console.error(error.message); process.exitCode = 1; }).finally(async () => {
  await p.$disconnect(); report.finishedAt = new Date().toISOString(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
});
