// Read-only SQL Server catalog acceptance. No schema or business writes.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

const header = 'operational_overhead_period_allocations';
const line = 'operational_overhead_allocation_lines';
const source = 'operational_overhead_allocation_sources';
const parent = 'production_run_cost_snapshots';
const expectedFks = [
  ['ohoa_company_fk', header, 'companyId', 'companies', 2000],
  ['ohoa_branch_fk', header, 'branchId', 'branches', 2000],
  ['ohoa_period_fk', header, 'periodId', 'operational_overhead_periods', 400],
  ['ohol_company_fk', line, 'companyId', 'companies', 2000],
  ['ohol_branch_fk', line, 'branchId', 'branches', 2000],
  ['ohol_allocation_fk', line, 'allocationId', header, 400],
  ['ohol_period_fk', line, 'periodId', 'operational_overhead_periods', 400],
  ['ohol_productionRun_fk', line, 'productionRunId', 'production_runs', 2000],
  ['ohol_costSnapshot_fk', line, 'costSnapshotId', parent, 382],
  ['ohol_destinationCostCenter_fk', line, 'destinationCostCenterId', 'cost_centers', 2000],
  ['ohos_company_fk', source, 'companyId', 'companies', 2000],
  ['ohos_branch_fk', source, 'branchId', 'branches', 2000],
  ['ohos_allocation_fk', source, 'allocationId', header, 400],
  ['ohos_sourceEntry_fk', source, 'sourceEntryId', 'operational_overhead_entries', 400],
];

function assertForeignKeys(rows) {
  assert.equal(rows.length, expectedFks.length, 'Exactly 14 B2 FK column relationships');
  assert.equal(new Set(rows.map(row => row.name)).size, 14, 'No duplicate or composite replacement FK');
  for (const [name, table, column, referenced, bytes] of expectedFks) {
    const row = rows.find(item => item.name === name);
    assert.ok(row, `Missing ${name}`);
    assert.deepEqual([row.child_table, row.child_column, row.parent_table, row.parent_column], [table, column, referenced, 'id'], name);
    for (const side of ['child', 'parent']) {
      assert.equal(row[`${side}_system_type_id`], 231, `${name} ${side} NVARCHAR`);
      assert.equal(row[`${side}_max_length`], bytes, `${name} ${side} byte width`);
      assert.equal(row[`${side}_collation`], 'Chinese_PRC_CI_AS', `${name} ${side} collation`);
    }
    assert.equal(Number(row.is_disabled), 0, `${name} enabled`);
    assert.equal(Number(row.is_not_trusted), 0, `${name} trusted`);
    assert.equal(row.delete_action, 'NO_ACTION', `${name} delete action`);
    assert.equal(row.update_action, 'NO_ACTION', `${name} update action`);
  }
  return { fkCount: rows.length, fkWidthMismatchCount: 0, costSnapshotFkWidthMatch: 'PASS' };
}

function assertParent(catalog) {
  const columns = catalog.columns.filter(row => row.table_name === parent);
  assert.equal(columns.length, 13);
  const sizes = { id: 382, companyId: 2000, branchId: 2000, productionRunId: 2000, finalProductId: 2000, currencyCode: 20, costBasis: 200, closedById: 2000, createdById: 2000 };
  for (const [name, bytes] of Object.entries(sizes)) {
    const column = columns.find(row => row.name === name);
    assert.ok(column, name);
    assert.equal(column.system_type_id, 231, name);
    assert.equal(column.max_length, bytes, name);
    assert.equal(column.collation_name, 'Chinese_PRC_CI_AS', name);
    assert.equal(Number(column.is_nullable), ['closedById', 'createdById'].includes(name) ? 1 : 0, name);
    assert.equal(column.default_name, null, `${name}: no physical default`);
  }
  for (const [name, precision] of [['finalGoodQuantity', 18], ['netMaterialValue', 19]]) {
    const column = columns.find(row => row.name === name);
    assert.deepEqual([column.system_type_id, column.precision, column.scale, Number(column.is_nullable), column.default_name], [106, precision, 4, 0, null], name);
  }
  for (const [name, constraint] of [['closedAt', 'df_production_run_cost_snapshots_closed_at'], ['createdAt', 'df_production_run_cost_snapshots_created_at']]) {
    const column = columns.find(row => row.name === name);
    assert.deepEqual([column.system_type_id, column.scale, Number(column.is_nullable), column.default_name], [42, 7, 0, constraint], name);
    assert.equal(column.default_definition?.replace(/[\s()]/g, '').toLowerCase(), 'getutcdate', `${name}: definition must be visible and UTC`);
  }
  const indexes = catalog.indexes.filter(row => row.table_name === parent);
  const expected = {
    pk_production_run_cost_snapshots: ['id', 1, 1, 0],
    uq_production_run_cost_snapshots_run: ['productionRunId', 2, 1, 1],
    uq_production_run_cost_snapshots_tenant_run: ['companyId,branchId,productionRunId', 2, 1, 0],
    ix_production_run_cost_snapshots_tenant: ['companyId,branchId', 2, 0, 0],
    ix_production_run_cost_snapshots_run: ['productionRunId', 2, 0, 0],
    ix_production_run_cost_snapshots_product: ['finalProductId', 2, 0, 0],
  };
  assert.equal(indexes.length, 6);
  for (const [name, values] of Object.entries(expected)) {
    const index = indexes.find(row => row.name === name);
    assert.ok(index, name);
    assert.deepEqual([index.columns, index.type, Number(index.is_unique), Number(index.is_unique_constraint)], values, name);
    assert.equal(Number(index.is_disabled), 0, name);
  }
  const fks = catalog.foreign_keys.filter(row => row.child_table === parent);
  assert.equal(fks.length, 4);
  for (const [suffix, column, table] of [['company', 'companyId', 'companies'], ['branch', 'branchId', 'branches'], ['run', 'productionRunId', 'production_runs'], ['product', 'finalProductId', 'products']]) {
    const fk = fks.find(row => row.name === `fk_production_run_cost_snapshots_${suffix}`);
    assert.ok(fk, suffix);
    assert.deepEqual([fk.child_column, fk.parent_table, fk.parent_column, Number(fk.is_disabled), Number(fk.is_not_trusted), fk.delete_action, fk.update_action], [column, table, 'id', 0, 0, 'NO_ACTION', 'NO_ACTION'], suffix);
  }
  const physical = { columns, indexes, foreign_keys: fks };
  return { parentPhysicalContract: 'PASS', fingerprint: createHash('sha256').update(JSON.stringify(physical)).digest('hex'), physical };
}

const tablesSql = [header, line, source, parent].map(name => `'${name}'`).join(',');
const query = `SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON;
SELECT
(SELECT t.name AS table_name,c.name,c.system_type_id,c.max_length,c.precision,c.scale,c.is_nullable,c.collation_name,d.name AS default_name,d.definition AS default_definition FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id LEFT JOIN sys.default_constraints d ON d.object_id=c.default_object_id WHERE SCHEMA_NAME(t.schema_id)='dbo' AND t.name IN (${tablesSql}) ORDER BY t.name,c.column_id FOR JSON PATH,INCLUDE_NULL_VALUES) AS columns,
(SELECT t.name AS table_name,i.name,i.type,i.is_unique,i.is_unique_constraint,i.is_disabled,STUFF((SELECT ','+c.name FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0 ORDER BY ic.key_ordinal FOR XML PATH(''),TYPE).value('.','nvarchar(max)'),1,1,'') AS columns,(SELECT SUM(CONVERT(int,c.max_length)) FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0) AS key_bytes FROM sys.tables t JOIN sys.indexes i ON i.object_id=t.object_id WHERE SCHEMA_NAME(t.schema_id)='dbo' AND t.name IN (${tablesSql}) AND i.index_id>0 ORDER BY t.name,i.name FOR JSON PATH) AS indexes,
(SELECT fk.name,t.name AS child_table,c.name AS child_column,pt.name AS parent_table,pc.name AS parent_column,c.system_type_id AS child_system_type_id,pc.system_type_id AS parent_system_type_id,c.max_length AS child_max_length,pc.max_length AS parent_max_length,c.collation_name AS child_collation,pc.collation_name AS parent_collation,fk.is_disabled,fk.is_not_trusted,fk.delete_referential_action_desc AS delete_action,fk.update_referential_action_desc AS update_action FROM sys.foreign_keys fk JOIN sys.tables t ON t.object_id=fk.parent_object_id JOIN sys.foreign_key_columns fc ON fc.constraint_object_id=fk.object_id JOIN sys.columns c ON c.object_id=fc.parent_object_id AND c.column_id=fc.parent_column_id JOIN sys.tables pt ON pt.object_id=fc.referenced_object_id JOIN sys.columns pc ON pc.object_id=fc.referenced_object_id AND pc.column_id=fc.referenced_column_id WHERE SCHEMA_NAME(t.schema_id)='dbo' AND t.name IN (${tablesSql}) ORDER BY t.name,fk.name,fc.constraint_column_id FOR JSON PATH,INCLUDE_NULL_VALUES) AS foreign_keys,
(SELECT t.name AS table_name,cc.name,cc.is_disabled,cc.is_not_trusted,cc.definition FROM sys.check_constraints cc JOIN sys.tables t ON t.object_id=cc.parent_object_id WHERE SCHEMA_NAME(t.schema_id)='dbo' AND t.name IN (${tablesSql}) ORDER BY t.name,cc.name FOR JSON PATH) AS checks
FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;`;

function assertB2(catalog) {
  const fk = assertForeignKeys(catalog.foreign_keys.filter(row => row.child_table !== parent));
  assert.equal(catalog.columns.filter(row => row.table_name !== parent).length, 50);
  const indexes = catalog.indexes.filter(row => row.table_name !== parent);
  const keys = { ohoa_pk: 400, ohoa_period_uq: 400, ohoa_request_uq: 1200, ohoa_scope_ix: 828, ohol_pk: 400, ohol_target_purpose_uq: 860, ohos_pk: 400, ohos_allocation_ix: 800 };
  assert.equal(indexes.length, 8);
  for (const index of indexes) {
    assert.equal(index.key_bytes, keys[index.name], index.name);
    assert.ok(index.key_bytes <= (index.type === 1 ? 900 : 1700), index.name);
    assert.equal(Number(index.is_disabled), 0, index.name);
  }
  const checks = catalog.checks.filter(row => row.table_name !== parent);
  const names = ['ohoa_status_ck','ohoa_version_ck','ohoa_final_ck','ohoa_range_ck','ohoa_companyKey_ck','ohoa_branchKey_ck','ohoa_currency_ck','ohol_amount_ck','ohol_driver_ck','ohol_driver_type_ck','ohol_purpose_ck','ohol_companyKey_ck','ohol_branchKey_ck','ohol_productionRunKey_ck','ohol_destinationCostCenterKey_ck','ohol_currency_ck','ohos_companyKey_ck','ohos_branchKey_ck'];
  assert.deepEqual(checks.map(row => row.name).sort(), names.sort());
  checks.forEach(row => { assert.equal(Number(row.is_disabled), 0, row.name); assert.equal(Number(row.is_not_trusted), 0, row.name); assert.ok(row.definition, `${row.name} visible definition`); });
  return { ...fk, tableCount: 3, columnCount: 50, keyCount: 8, unsafeKeyCount: 0, trustedCheckCount: 18 };
}

function parentDdlStatements(sql) {
  return sql.replace(/--[^\n]*/g, '').split(';').map(value => value.trim()).filter(value => /production_run_cost_snapshots/i.test(value) && !/^ALTER TABLE \[dbo\]\.\[operational_overhead_allocation_lines\]\s+ADD CONSTRAINT \[ohol_costSnapshot_fk\] FOREIGN KEY/is.test(value));
}

module.exports = { assertForeignKeys, assertParent, assertB2, parentDdlStatements, expectedFks };
if (require.main === module) {
  const [mode, database, output] = process.argv.slice(2);
  assert.ok(['parent', 'b2'].includes(mode), 'Mode parent or b2 required');
  assert.match(database || '', /^ATsoftERP_[A-Za-z0-9_]+$/);
  assert.ok(output, 'Explicit evidence output path required');
  const result = spawnSync('sqlcmd', ['-S','tcp:localhost,50079','-E','-C','-b','-d',database,'-Q',query,'-y','0','-w','65535'], { encoding: 'utf8', windowsHide: true, maxBuffer: 10*1024*1024 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const catalog = JSON.parse(result.stdout.replace(/\r?\n/g, '').trim());
  const parentProof = assertParent(catalog);
  const proof = { database, mode, parent: parentProof, b2: mode === 'b2' ? assertB2(catalog) : null, catalog };
  fs.writeFileSync(output, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ database, mode, parentFingerprint: parentProof.fingerprint, parent: 'PASS', b2: proof.b2 }, null, 2));
}
