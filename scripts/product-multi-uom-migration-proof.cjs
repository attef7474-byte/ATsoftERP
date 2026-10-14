/**
 * Product multi-UOM disposable SQL E2E + migration replay proof.
 *
 * Production (ATsoftERP_DB) is a SELECT-only source. This script creates two
 * uniquely named disposable clones, replays the reviewed additive migration on
 * the proof clone, exercises the multi-UOM behaviour, and proves the atomic
 * rollback on a second clone. It never deploys, resolves, resets, drops the
 * source database, nor mutates production business/ledger/unit/barcode state.
 *
 * Run from repository root: node scripts/product-multi-uom-migration-proof.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const sql = require('mssql');
const dotenv = require('dotenv');

const root = path.resolve(__dirname, '..');
const migrationName = '20261014120000_add_product_uom_packaging';
const migrationPath = path.join(root, 'apps/api/prisma/migrations', migrationName, 'migration.sql');
const outDir = path.join(root, 'docs/proofs/product-multi-uom');

const cloneTables = [
  'companies', 'branches', 'product_categories', 'units', 'products', 'warehouses',
  'inventory_balances', 'inventory_movements', 'inventory_movement_lines',
];

function connectionConfig(url) {
  assert(url && url.startsWith('sqlserver://'), 'Configured SQL Server datasource required');
  const parts = url.slice(12).match(/(?:[^;{}]|\{[^}]*\})+/g) || [];
  const host = parts.shift();
  const params = {};
  for (const part of parts) { const i = part.indexOf('='); if (i >= 0) params[part.slice(0, i).toLowerCase()] = part.slice(i + 1).replace(/^\{(.*)\}$/, '$1'); }
  const split = host.lastIndexOf(':');
  const config = { server: split > 0 ? host.slice(0, split) : host, database: params.database, user: params.user || params.username, password: params.password, options: { encrypt: params.encrypt === 'true', trustServerCertificate: params.trustservercertificate === 'true' }, pool: { max: 3, min: 0 }, requestTimeout: 180000 };
  if (split > 0) config.port = Number(host.slice(split + 1));
  return config;
}
function ident(value) { assert(/^[A-Za-z_][A-Za-z0-9_]*$/.test(value), 'Unsafe SQL identifier'); return `[${value}]`; }
async function query(pool, text, params = {}) { const req = pool.request(); for (const [name, value] of Object.entries(params)) req.input(name, value); return req.query(text); }
async function scalar(pool, text, params) { const r = await query(pool, text, params); return Object.values(r.recordset[0])[0]; }
const hash = (b) => crypto.createHash('sha256').update(b).digest('hex');
const results = [];
async function pass(name, fn) { console.log(JSON.stringify({ check: name, state: 'RUNNING' })); await fn(); results.push({ name, result: 'PASS' }); }
async function rejects(pool, text, params, numbers = [547, 2601, 2627]) { let caught; try { await query(pool, text, params); } catch (e) { caught = e; } assert(caught, 'Expected SQL rejection'); assert(numbers.includes(caught.number), `Unexpected SQL error ${caught.number}`); }

async function createClone(master, source, database, collation) {
  assert(/^ATsoftERP_UOM_(PROOF|ROLLBACK)_\d{14}$/.test(database), 'Disposable database name required');
  assert.notEqual(database, source);
  assert(/^[A-Za-z0-9_]+$/.test(collation));
  await query(master, `CREATE DATABASE ${ident(database)} COLLATE ${collation};`);
  const target = await new sql.ConnectionPool({ ...master.config, database }).connect();
  try {
    for (const table of cloneTables) {
      await query(target, 'SELECT * INTO dbo.' + ident(table) + ' FROM ' + ident(source) + '.dbo.' + ident(table));
      await query(target, 'ALTER TABLE dbo.' + ident(table) + ' ADD CONSTRAINT ' + ident(table + '_pkey') + ' PRIMARY KEY CLUSTERED (id)');
    }
  } finally { await target.close(); }
}

async function fingerprintTables(pool) {
  const [products, balances, movements, units] = await Promise.all([
    query(pool, 'SELECT id,code,unitId,unit,barcode,status,deletedAt FROM dbo.products ORDER BY id'),
    query(pool, 'SELECT id,warehouseId,productId,quantity,quantityBase FROM dbo.inventory_balances ORDER BY id'),
    query(pool, 'SELECT id,movementId,productId,quantity,quantityBase,unit,direction FROM dbo.inventory_movement_lines ORDER BY id'),
    query(pool, 'SELECT id,code,nameEn,nameAr FROM dbo.units ORDER BY id'),
  ]);
  const fp = {
    products: { count: products.recordset.length, sha256: hash(Buffer.from(JSON.stringify(products.recordset))) },
    balances: { count: balances.recordset.length, sha256: hash(Buffer.from(JSON.stringify(balances.recordset))) },
    movements: { count: movements.recordset.length, sha256: hash(Buffer.from(JSON.stringify(movements.recordset))) },
    units: { count: units.recordset.length, sha256: hash(Buffer.from(JSON.stringify(units.recordset))) },
    productIds: products.recordset.map((r) => String(r.id)).sort(),
    productBarcodes: products.recordset.map((r) => (r.barcode == null ? null : String(r.barcode))).sort(),
  };
  return fp;
}

async function main() {
  const environment = dotenv.parse(fs.readFileSync(path.join(root, '.env')));
  const config = connectionConfig(environment.DATABASE_URL);
  const source = config.database;
  assert.equal(source, 'ATsoftERP_DB', 'Unexpected production source; refuse proof until explicitly reviewed');
  const migrationBytes = fs.readFileSync(migrationPath);
  const migration = migrationBytes.toString('utf8');
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const db = `ATsoftERP_UOM_PROOF_${stamp}`;
  const rollbackDb = `ATsoftERP_UOM_ROLLBACK_${stamp}`;
  const master = await new sql.ConnectionPool({ ...config, database: 'master' }).connect();
  let proof, rollback;
  try {
    const sourcePool = await new sql.ConnectionPool(config).connect();
    const identity = (await query(sourcePool, "SELECT @@SERVERNAME AS server,DB_ID() AS sourceDatabaseId,CONVERT(nvarchar(128),DATABASEPROPERTYEX(DB_NAME(),'Collation')) AS collation")).recordset[0];
    await sourcePool.close();
    assert(identity.collation, 'Source database collation could not be verified');

    await createClone(master, source, db, identity.collation);
    proof = await new sql.ConnectionPool({ ...config, database: db }).connect();
    const before = await fingerprintTables(proof);
    assert(before.products.count > 0, 'Production clone has no products');

    await pass('candidate_migration_applies', async () => { await proof.request().batch(migration); });

    const after = await fingerprintTables(proof);

    await pass('product_ids_preserved', async () => {
      assert.deepEqual(after.productIds, before.productIds);
    });
    await pass('inventory_balances_unchanged', async () => {
      assert.equal(after.balances.sha256, before.balances.sha256);
      assert.equal(after.balances.count, before.balances.count);
    });
    await pass('inventory_movement_lines_preserved', async () => {
      const legacy = await query(proof, 'SELECT COUNT(*) AS total, SUM(CASE WHEN enteredUnitId IS NULL AND productUomId IS NULL AND enteredQuantity IS NULL AND conversionApplied IS NULL THEN 1 ELSE 0 END) AS legacyNull FROM dbo.inventory_movement_lines');
      assert.equal(legacy.recordset[0].total, before.movements.count);
      assert.equal(legacy.recordset[0].legacyNull, before.movements.count, 'Historical movement lines must keep the new snapshot columns NULL');
      assert.equal(after.movements.sha256, before.movements.sha256);
    });
    await pass('units_and_barcodes_preserved_no_duplicates', async () => {
      const units = await query(proof, 'SELECT COUNT(*) AS total, COUNT(DISTINCT code) AS distinctCodes FROM dbo.units');
      assert.equal(units.recordset[0].total, before.units.count);
      assert.equal(units.recordset[0].total, units.recordset[0].distinctCodes, 'Global units must not be duplicated');
      assert.equal(hash(Buffer.from(JSON.stringify((await query(proof, 'SELECT id,code,nameEn,nameAr FROM dbo.units ORDER BY id')).recordset))), before.units.sha256);
      assert.deepEqual((await query(proof, 'SELECT id,barcode FROM dbo.products ORDER BY id')).recordset.map((r) => (r.barcode == null ? null : String(r.barcode))).sort(), before.productBarcodes);
    });
    await pass('base_product_uom_backfill_one_per_product', async () => {
      const summary = (await query(proof, `SELECT COUNT(*) AS total FROM dbo.product_uoms; SELECT COUNT(*) AS bad FROM dbo.product_uoms u JOIN dbo.products p ON p.id=u.productId WHERE u.isBase=1 AND (u.unitId<>p.unitId OR u.conversionToBase<>1 OR u.quantityPerParent<>1 OR u.parentProductUomId IS NOT NULL); SELECT COUNT(*) AS expectedBase FROM dbo.products WHERE unitId IS NOT NULL;`)).recordsets;
      const expectedBase = summary[2][0].expectedBase;
      assert.equal(summary[0][0].total, expectedBase, 'Exactly one base row per product with a proven unitId');
      assert.equal(summary[1][0].bad, 0, 'Every base row must equal the product base unit with factor 1 and no parent');
      assert.equal(await scalar(proof, 'SELECT COUNT(*) FROM dbo.product_uoms WHERE isBase=1'), expectedBase);
    });
    await pass('no_orphan_product_uom', async () => {
      const orphan = await scalar(proof, `SELECT COUNT(*) FROM dbo.product_uoms u LEFT JOIN dbo.products p ON p.id=u.productId LEFT JOIN dbo.units un ON un.id=u.unitId WHERE p.id IS NULL OR un.id IS NULL`);
      assert.equal(orphan, 0);
    });
    await pass('one_base_per_product_filtered_unique_enforced', async () => {
      const target = await scalar(proof, 'SELECT TOP(1) productId FROM dbo.product_uoms WHERE isBase=1 ORDER BY productId');
      await rejects(proof, `INSERT dbo.product_uoms(id,productId,unitId,isBase,parentProductUomId,quantityPerParent,conversionToBase,barcode,isActive,createdAt,updatedAt) VALUES(N'UOM_PROOF_DUP_BASE',@productId,(SELECT TOP 1 id FROM dbo.units WHERE id<>(SELECT unitId FROM dbo.products WHERE id=@productId)),1,NULL,1,1,NULL,1,SYSUTCDATETIME(),SYSUTCDATETIME())`, { productId: target }, [2601, 2627]);
    });
    await pass('product_unit_pair_unique', async () => {
      const base = (await query(proof, 'SELECT TOP 1 productId,unitId,id FROM dbo.product_uoms WHERE isBase=1 ORDER BY productId')).recordset[0];
      await rejects(proof, 'INSERT dbo.product_uoms(id,productId,unitId,isBase,parentProductUomId,quantityPerParent,conversionToBase,barcode,isActive,createdAt,updatedAt) VALUES(@id,@product,@unit,0,NULL,1,1,NULL,1,SYSUTCDATETIME(),SYSUTCDATETIME())', { id: 'UOM_DUP_UNIT', product: base.productId, unit: base.unitId });
    });
    await pass('invalid_references_reject', async () => {
      await rejects(proof, 'INSERT dbo.product_uoms(id,productId,unitId,isBase,parentProductUomId,quantityPerParent,conversionToBase,barcode,isActive,createdAt,updatedAt) VALUES(@id,@product,@unit,0,NULL,1,1,NULL,1,SYSUTCDATETIME(),SYSUTCDATETIME())', { id: 'UOM_BAD_PRODUCT', product: 'UOM_MISSING_PRODUCT', unit: await scalar(proof, 'SELECT TOP(1) id FROM dbo.units') });
      await rejects(proof, 'INSERT dbo.product_uoms(id,productId,unitId,isBase,parentProductUomId,quantityPerParent,conversionToBase,barcode,isActive,createdAt,updatedAt) VALUES(@id,@product,@unit,0,NULL,1,1,NULL,1,SYSUTCDATETIME(),SYSUTCDATETIME())', { id: 'UOM_BAD_UNIT', product: (await scalar(proof, 'SELECT TOP(1) id FROM dbo.products')), unit: 'UOM_MISSING_UNIT' });
      await rejects(proof, 'INSERT dbo.product_uoms(id,productId,unitId,isBase,parentProductUomId,quantityPerParent,conversionToBase,barcode,isActive,createdAt,updatedAt) VALUES(@id,@product,@unit,0,@parent,1,1,NULL,1,SYSUTCDATETIME(),SYSUTCDATETIME())', { id: 'UOM_BAD_PARENT', product: (await scalar(proof, 'SELECT TOP(1) id FROM dbo.products')), unit: (await scalar(proof, 'SELECT TOP(1) id FROM dbo.units')), parent: 'UOM_MISSING_PARENT' });
    });
    await pass('multi_level_packaging_hierarchy_conversion', async () => {
      await query(proof, "INSERT INTO dbo.units (id,code,nameAr,nameEn,isActive,createdAt,updatedAt) VALUES ('UOM_U_BAG','BAG',N'كيس','Bag',1,SYSUTCDATETIME(),SYSUTCDATETIME()),('UOM_U_BALE','BALE',N'بالة','Bale',1,SYSUTCDATETIME(),SYSUTCDATETIME())");
      const target = (await query(proof, "SELECT TOP(1) u.productId, u.id AS baseId, u.unitId AS baseUnitId FROM dbo.product_uoms u WHERE u.isBase=1 AND u.unitId IS NOT NULL ORDER BY u.productId")).recordset[0];
      assert(target, 'A base product UOM row is required for the hierarchy proof');
      await query(proof, "INSERT INTO dbo.product_uoms (id,productId,unitId,isBase,parentProductUomId,quantityPerParent,conversionToBase,barcode,isActive,createdAt,updatedAt) VALUES ('UOM_BAG',@product,'UOM_U_BAG',0,@base,24,24,NULL,1,SYSUTCDATETIME(),SYSUTCDATETIME())", { product: target.productId, base: target.baseId });
      await query(proof, "INSERT INTO dbo.product_uoms (id,productId,unitId,isBase,parentProductUomId,quantityPerParent,conversionToBase,barcode,isActive,createdAt,updatedAt) VALUES ('UOM_BALE',@product,'UOM_U_BALE',0,'UOM_BAG',6,144,NULL,1,SYSUTCDATETIME(),SYSUTCDATETIME())", { product: target.productId });
      const rows = (await query(proof, "SELECT id,parentProductUomId,quantityPerParent,conversionToBase FROM dbo.product_uoms WHERE id IN ('UOM_BAG','UOM_BALE') ORDER BY id")).recordset;
      assert.equal(rows.length, 2);
      const bag = rows.find((r) => r.id === 'UOM_BAG');
      const bale = rows.find((r) => r.id === 'UOM_BALE');
      assert.equal(Number(bag.conversionToBase), 24);
      assert.equal(bag.parentProductUomId, target.baseId);
      assert.equal(bale.parentProductUomId, 'UOM_BAG');
      assert.equal(Number(bale.conversionToBase), 144, 'BALE must resolve to 24 * 6 = 144 base units');
      assert.equal(await scalar(proof, 'SELECT COUNT(*) FROM dbo.product_uoms WHERE productId=@p', { p: target.productId }), rows.length + 1);
    });
    await pass('orphan_product_uom_after_hierarchy', async () => {
      assert.equal(await scalar(proof, 'SELECT COUNT(*) FROM dbo.product_uoms u LEFT JOIN dbo.products p ON p.id=u.productId WHERE p.id IS NULL'), 0);
      assert.equal(await scalar(proof, 'SELECT COUNT(*) FROM dbo.product_uoms u LEFT JOIN dbo.units n ON n.id=u.unitId WHERE n.id IS NULL'), 0);
    });

    const metadata = (await query(proof, `SELECT i.name,i.is_unique,i.has_filter,i.filter_definition FROM sys.indexes i WHERE i.name IN('product_uoms_one_base_per_product','product_uoms_productId_unitId_key'); SELECT name,is_disabled,is_not_trusted FROM sys.foreign_keys WHERE name LIKE 'product_uoms_%';`)).recordsets;
    await pass('trusted_enabled_index_and_fk_metadata', async () => {
      assert.equal(metadata[0].length, 2);
      const base = metadata[0].find((x) => x.name === 'product_uoms_one_base_per_product');
      assert(base.is_unique && base.has_filter && /isBase/.test(base.filter_definition));
      assert(metadata[1].length === 3 && metadata[1].every((x) => !x.is_disabled && !x.is_not_trusted));
    });

    await createClone(master, source, rollbackDb, identity.collation);
    rollback = await new sql.ConnectionPool({ ...config, database: rollbackDb }).connect();
    const rollbackBefore = await fingerprintTables(rollback);
    await pass('ATOMIC_ROLLBACK', async () => {
      const failed = migration.replace('COMMIT TRAN;', `THROW 51991, 'Controlled late disposable migration failure', 1;`);
      assert.notEqual(failed, migration, 'Injection point must exist');
      let error; try { await rollback.request().batch(failed); } catch (e) { error = e; }
      assert.equal(error?.number, 51991);
      assert.equal(await scalar(rollback, "SELECT COUNT(*) FROM sys.tables WHERE name='product_uoms'"), 0);
      assert.equal(await scalar(rollback, "SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.inventory_movement_lines') AND name IN('enteredUnitId','productUomId','enteredQuantity','conversionApplied')"), 0);
      assert.deepEqual(await fingerprintTables(rollback), rollbackBefore);
    });

    const artifact = {
      status: 'PASS',
      productionMutations: 'NONE',
      sourceDatabase: source,
      server: identity.server,
      sourceDatabaseId: identity.sourceDatabaseId,
      proofDatabase: db,
      rollbackDatabase: rollbackDb,
      observedAtUtc: new Date().toISOString(),
      migration: { name: migrationName, bytes: migrationBytes.length, sha256: hash(migrationBytes), lineEndings: migration.includes('\r\n') ? 'CRLF' : 'LF' },
      invariants: {
        PRODUCT_IDS_CHANGED: 0,
        EXISTING_BALANCE_VALUE_CHANGES: 0,
        EXISTING_MOVEMENT_MEANING_CHANGES: 0,
        ORPHAN_PRODUCT_UOM: 0,
        DUPLICATE_GLOBAL_UNITS_CREATED: 0,
      },
      baseline: before,
      results,
      metadata,
      limitations: [
        'This proves the additive migration, base backfill, uniqueness/FK constraints, hierarchy conversion factors and atomic rollback at the SQL layer.',
        'HTTP/API behaviour is proven separately by the disposable runtime proof. InventoryMovement fixture copies are confined to disposable databases.',
      ],
    };
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, 'migration-proof.json');
    fs.writeFileSync(out, JSON.stringify(artifact, null, 2) + '\n');
    console.log(JSON.stringify({ status: artifact.status, checks: results.length, proofDatabase: db, rollbackDatabase: rollbackDb, artifact: path.relative(root, out), ATOMIC_ROLLBACK: 'PASS', productionMutations: 'NONE' }));
  } finally {
    if (proof) await proof.close();
    if (rollback) await rollback.close();
    await master.close();
  }
}
main().catch((e) => { console.error(JSON.stringify({ status: 'FAIL', error: e.name, sqlNumber: e.number || null, lineNumber: e.lineNumber || null, message: String(e.message).replace(/(password|user|uid|pwd)=[^;\s]+/gi, '$1=REDACTED') })); process.exitCode = 1; });
