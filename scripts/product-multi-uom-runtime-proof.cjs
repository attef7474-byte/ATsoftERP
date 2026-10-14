/**
 * Product multi-UOM disposable runtime proof.
 *
 * Restores the latest production full backup into a uniquely named disposable
 * database, replays the reviewed additive migration on it, launches the built
 * API against that disposable database, and exercises the real multi-UOM HTTP
 * surface (product create with packaging hierarchy, movement conversion,
 * snapshot persistence, base-unit lock, permissions, idempotency, tenant and
 * reference isolation). Production is read-only here.
 *
 * Run from repository root: node scripts/product-multi-uom-runtime-proof.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const { spawn, spawnSync } = require('child_process');
const sql = require('mssql');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { PrismaClient, Prisma } = require('@prisma/client');
const { PrismaMssql } = require('@prisma/adapter-mssql');

const root = path.resolve(__dirname, '..');
const migrationPath = path.join(root, 'apps/api/prisma/migrations/20261014120000_add_product_uom_packaging/migration.sql');
const outDir = path.join(root, 'docs/proofs/product-multi-uom');
const runtimeFile = path.join(root, '.tmp/product-multi-uom-runtime.json');
const apiLog = path.join(root, '.tmp/pum-runtime-api.log');
const API_PORT = 4311;
const BASE = `http://127.0.0.1:${API_PORT}/api/v1`;

const env = dotenv.parse(fs.readFileSync(path.join(root, '.env')));
function connectionConfig(url) {
  const fields = url.slice(12).split(';');
  const host = fields.shift().split(':');
  const opts = Object.fromEntries(fields.filter((x) => x.includes('=')).map((x) => [x.slice(0, x.indexOf('=')).toLowerCase(), x.slice(x.indexOf('=') + 1)]));
  return { server: host[0], port: +host[1] || 1433, database: opts.database, user: opts.user, password: opts.password, options: { encrypt: opts.encrypt === 'true', trustServerCertificate: true }, requestTimeout: 180000 };
}
const config = connectionConfig(env.DATABASE_URL);
assert.equal(config.database, 'ATsoftERP_DB', 'Production datasource required as the read-only restore source');

/**
 * A RESTORE preserves the source database's contained-user SIDs, leaving the
 * server login orphaned inside the clone (no db_owner rights). Re-map the login
 * to the restored database as an administrator so the disposable migrations and
 * Prisma operations can run. This only touches the disposable clone.
 */
function grantDisposableOwner(database) {
  const login = config.user;
  assert(login && /^[A-Za-z0-9_.\\-]+$/.test(login), 'A SQL login is required to grant disposable ownership');
  const instance = `${config.server},${config.port}`;
  const script = [
    `USE [${database}]`,
    `IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'${login}' AND type IN ('S','U')) ALTER USER [${login}] WITH LOGIN = [${login}]`,
    `ELSE CREATE USER [${login}] FOR LOGIN [${login}]`,
    `ALTER ROLE db_owner ADD MEMBER [${login}]`,
  ].join('; ');
  const result = spawnSync('sqlcmd', ['-E', '-b', '-S', instance, '-Q', script], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, 'Disposable owner grant failed: ' + (result.stderr || result.stdout));
}

async function createDisposableRuntime() {
  const source = await new sql.ConnectionPool(config).connect();
  const backup = (await source.request().query("SELECT TOP(1) f.physical_device_name AS fileName, b.backup_finish_date AS finishedAt FROM msdb.dbo.backupmediafamily f JOIN msdb.dbo.backupset b ON b.media_set_id=f.media_set_id WHERE b.database_name=DB_NAME() AND b.type='D' ORDER BY b.backup_finish_date DESC")).recordset[0];
  assert(backup?.fileName, 'An existing production backup is required (this script never backs up or mutates production)');
  await source.close();

  const db = 'ATsoftERP_UOM_RUNTIME_' + new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  assert(/^ATsoftERP_UOM_RUNTIME_\d{14}$/.test(db), 'Disposable runtime database name required');

  const master = await new sql.ConnectionPool({ ...config, database: 'master' }).connect();
  try {
    const files = (await master.request().input('backup', backup.fileName).query('RESTORE FILELISTONLY FROM DISK=@backup')).recordset;
    const locations = (await master.request().query("SELECT CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultDataPath')) AS dataPath, CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultLogPath')) AS logPath")).recordset[0];
    assert(locations.dataPath && locations.logPath);
    const quote = (x) => "N'" + String(x).replace(/'/g, "''") + "'";
    const moves = files.map((f, i) => 'MOVE ' + quote(f.LogicalName) + ' TO ' + quote(path.win32.join(f.Type === 'L' ? locations.logPath : locations.dataPath, db + '_' + i + (f.Type === 'L' ? '.ldf' : '.mdf'))));
    await master.request().input('backup', backup.fileName).query('RESTORE DATABASE [' + db + '] FROM DISK=@backup WITH ' + moves.join(',') + ', RECOVERY');
  } finally { await master.close(); }

  grantDisposableOwner(db);

  const clone = await new sql.ConnectionPool({ ...config, database: db }).connect();
  try {
    assert.equal((await clone.request().query('SELECT DB_NAME() AS name')).recordset[0].name, db);
    const pre = await clone.request().query("SELECT COUNT(*) AS n FROM sys.tables WHERE name='product_uoms'");
    assert.equal(pre.recordset[0].n, 0, 'Pre-migration clone must not already contain product_uoms');
    await clone.request().batch(fs.readFileSync(migrationPath, 'utf8'));
    const post = await clone.request().query("SELECT COUNT(*) AS n FROM sys.tables WHERE name='product_uoms'");
    assert.equal(post.recordset[0].n, 1, 'Migration must create product_uoms');
    // Warm the restored clone before the API starts so the first interactive
    // transaction does not trip the 5s timeout while recovery/cold IO settles.
    const warmTables = ['products', 'product_uoms', 'units', 'product_categories', 'audit_logs', 'number_sequences', 'inventory_movements', 'inventory_movement_lines', 'companies', 'branches', 'warehouses', 'users', 'roles', 'permissions'];
    for (let round = 0; round < 5; round += 1) {
      for (const table of warmTables) await clone.request().query(`SELECT COUNT(*) AS n FROM dbo.[${table}]`);
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const identity = (await clone.request().query('SELECT DB_ID() AS id, DB_NAME() AS name')).recordset[0];
    fs.mkdirSync(path.dirname(runtimeFile), { recursive: true });
    fs.writeFileSync(runtimeFile, JSON.stringify({ database: db, databaseId: identity.id, backupFinishedAt: backup.finishedAt, candidateApplied: true, productionMutations: 'NONE' }, null, 2) + '\n');
    return { database: db, databaseId: identity.id, backupFinishedAt: backup.finishedAt };
  } finally { await clone.close(); }
}

function startApi(runtime) {
  const childEnv = { ...process.env, ...env, DATABASE_URL: env.DATABASE_URL.replace(/database=[^;]+/i, 'database=' + runtime.database), PORT: String(API_PORT), NODE_ENV: 'production', CORS_ORIGINS: 'http://127.0.0.1:4310', SWAGGER_ENABLED: 'false', SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '', MQTT_ENABLED: 'false' };
  assert(childEnv.DATABASE_URL.includes('database=' + runtime.database));
  const child = spawn(process.execPath, [path.join(root, 'apps/api/dist/src/main.js')], { cwd: path.join(root, 'apps/api'), env: childEnv, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const stream = fs.createWriteStream(apiLog);
  child.stdout.pipe(stream); child.stderr.pipe(stream);
  return child;
}
async function waitForHealth(timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { const r = await fetch(`${BASE}/health`); if (r.ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('API did not become healthy within ' + timeoutMs + 'ms');
}

async function main() {
  const runtime = await createDisposableRuntime();
  const url = env.DATABASE_URL.replace(/database=[^;]+/i, 'database=' + runtime.database);
  const db = new PrismaClient({ adapter: new PrismaMssql(url) });
  const api = startApi(runtime);
  const checks = [];
  const requests = [];
  const stamp = Date.now().toString();
  const prefix = 'PUM_' + stamp;
  const results = { status: 'PASS' };

  try {
    await waitForHealth();
    await db.$connect();
    assert.equal((await db.$queryRawUnsafe('SELECT DB_NAME() AS name'))[0].name, runtime.database);

    // Warm the freshly restored database so the first interactive transaction
    // does not trip the 5s Prisma transaction timeout on a cold-file cache.
    const warmTables = ['products', 'product_uoms', 'units', 'product_categories', 'audit_logs', 'number_sequences', 'inventory_movements', 'inventory_movement_lines', 'companies', 'branches', 'warehouses', 'users', 'roles', 'permissions'];
    for (let round = 0; round < 3; round += 1) {
      for (const table of warmTables) await db.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM dbo.[${table}]`);
    }

    const companyA = await db.company.create({ data: { code: prefix + '_A', name: 'Disposable tenant A' } });
    const branchA = await db.branch.create({ data: { companyId: companyA.id, code: prefix + '_A', name: 'Disposable branch A' } });
    const companyB = await db.company.create({ data: { code: prefix + '_B', name: 'Disposable tenant B' } });
    const branchB = await db.branch.create({ data: { companyId: companyB.id, code: prefix + '_B', name: 'Disposable branch B' } });
    const context = { companyId: companyA.id, branchId: branchA.id };
    const otherContext = { companyId: companyB.id, branchId: branchB.id };

    const keys = ['products:create', 'products:read', 'products:update', 'products:delete', 'inventory-movement:create', 'inventory-movement:read', 'inventory-movement:update', 'inventory-movement:post', 'inventory-movement:reverse', 'inventory-movement:cancel'];
    for (const key of keys) { const i = key.indexOf(':'); await db.permission.upsert({ where: { key }, update: {}, create: { key, module: key.slice(0, i), action: key.slice(i + 1) } }); }
    const perms = await db.permission.findMany({ where: { key: { in: keys } } });
    const role = await db.role.create({ data: { code: prefix + '_ROLE', name: 'Disposable multi-UOM role', permissions: { create: perms.map((p) => ({ permissionId: p.id })) } } });
    const limitedRole = await db.role.create({ data: { code: prefix + '_LIMITED', name: 'Disposable limited role', permissions: { create: perms.filter((p) => p.key === 'products:read' || p.key === 'inventory-movement:read').map((p) => ({ permissionId: p.id })) } } });

    const makeUser = (ctx, roleId, label) => db.user.create({ data: { name: 'PUM ' + label, email: prefix + '_' + label + '@proof.invalid', passwordHash: crypto.randomBytes(32).toString('hex'), ...ctx, roles: roleId ? { create: { roleId } } : undefined } });
    const userA = await makeUser({ companyId: companyA.id, branchId: branchA.id }, role.id, 'a');
    const limitedUser = await makeUser({ companyId: companyA.id, branchId: branchA.id }, limitedRole.id, 'limited');
    const deniedUser = await makeUser({ companyId: companyA.id, branchId: branchA.id }, null, 'denied');
    const userB = await makeUser({ companyId: companyB.id, branchId: branchB.id }, role.id, 'b');

    const pkg = await db.unit.create({ data: { id: prefix + '_PKG', code: prefix + '_PKG', nameAr: 'عبوة', nameEn: 'Package' } });
    const bag = await db.unit.create({ data: { id: prefix + '_BAG', code: prefix + '_BAG', nameAr: 'كيس', nameEn: 'Bag' } });
    const bale = await db.unit.create({ data: { id: prefix + '_BALE', code: prefix + '_BALE', nameAr: 'بالة', nameEn: 'Bale' } });
    const warehouseA = await db.warehouse.create({ data: { code: prefix + '_WA', name: 'PUM Warehouse A', companyId: companyA.id, branchId: branchA.id } });
    const warehouseB = await db.warehouse.create({ data: { code: prefix + '_WB', name: 'PUM Warehouse B', companyId: companyB.id, branchId: branchB.id } });

    const token = (user) => jwt.sign({ sub: user.id, authVersion: user.authVersion || 0 }, env.JWT_SECRET, { expiresIn: '2h' });
    async function call(method, route, body, user = userA, ctx = { companyId: companyA.id, branchId: branchA.id }, expected = 200) {
      if (method === 'POST' && expected === 200) expected = 201;
      const response = await fetch(BASE + route, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token(user), 'x-active-company-id': ctx.companyId, 'x-active-branch-id': ctx.branchId }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      let json = null; try { json = await response.json(); } catch { /* empty */ }
      requests.push({ method, route, status: response.status });
      if (response.status !== expected) throw new Error(`${method} ${route} expected ${expected} received ${response.status} ${JSON.stringify(json)}`);
      return json && json.data !== undefined ? json.data : json;
    }
    async function check(name, fn) { await fn(); checks.push({ name, result: 'PASS' }); console.log(JSON.stringify({ check: name, result: 'PASS' })); }

    let product, bagRow, baleRow, baseRow, movement;

    await check('product_multi_uom_create_persists_base_and_hierarchy', async () => {
      product = await call('POST', '/products', {
        code: prefix + '_P', name: 'Runtime Multi UOM Product', unitId: pkg.id,
        uoms: [
          { unitId: pkg.id, isBase: true, quantityPerParent: 1 },
          { unitId: bag.id, parentUnitId: pkg.id, quantityPerParent: 24 },
          { unitId: bale.id, parentUnitId: bag.id, quantityPerParent: 6 },
        ],
      });
      assert.equal(product.unitId, pkg.id);
      assert.equal(product.unitRef.id, pkg.id);
      const rows = product.uoms;
      assert.equal(rows.length, 3, 'base + 2 packaging levels persisted');
      baseRow = rows.find((r) => r.unitId === pkg.id);
      bagRow = rows.find((r) => r.unitId === bag.id);
      baleRow = rows.find((r) => r.unitId === bale.id);
      assert.equal(baseRow.isBase, true); assert.equal(baseRow.parentProductUomId, null); assert.equal(Number(baseRow.conversionToBase), 1);
      assert.equal(Number(bagRow.conversionToBase), 24); assert.equal(bagRow.parentProductUomId, baseRow.id);
      assert.equal(Number(baleRow.conversionToBase), 144, 'BALE resolves to 24 * 6'); assert.equal(baleRow.parentProductUomId, bagRow.id);
      assert.equal(rows.filter((r) => r.isBase).length, 1);
    });

    await check('product_create_requires_global_base_unit', async () => {
      await call('POST', '/products', { code: prefix + '_NOUNIT', name: 'No base unit' }, userA, { companyId: companyA.id, branchId: branchA.id }, 400);
    });

    await check('product_unknown_field_rejected', async () => {
      await call('POST', '/products', { code: prefix + '_X', name: 'Unknown field', unitId: pkg.id, bogusField: 'nope' }, userA, { companyId: companyA.id, branchId: branchA.id }, 400);
    });

    await check('movement_entered_alternate_unit_converts_to_base_and_snapshots', async () => {
      movement = await call('POST', '/inventory/movements', { warehouseId: warehouseA.id, movementType: 'RECEIPT', requestId: prefix + '_REQ1', lines: [{ productId: product.id, quantity: 5, direction: 'IN', enteredUnitId: bale.id }] });
      assert.equal(movement.status, 'DRAFT');
      const line = movement.lines[0];
      assert.equal(Number(line.quantity), 5, 'Entered quantity preserved');
      assert.equal(Number(line.quantityBase), 720, '5 BALE * 144 = 720 base');
      assert.equal(Number(line.enteredQuantity), 5);
      assert.equal(Number(line.conversionApplied), 144);
      assert.equal(line.enteredUnitId, bale.id);
      assert.equal(line.productUomId, baleRow.id);
    });

    await check('movement_product_uom_selection_converts_to_base', async () => {
      const m = await call('POST', '/inventory/movements', { warehouseId: warehouseA.id, movementType: 'RECEIPT', lines: [{ productId: product.id, quantity: 2, direction: 'IN', productUomId: bagRow.id }] });
      const line = m.lines[0];
      assert.equal(Number(line.quantityBase), 48, '2 BAG * 24 = 48 base');
      assert.equal(Number(line.conversionApplied), 24);
      assert.equal(line.productUomId, bagRow.id);
      assert.equal(line.enteredUnitId, bag.id);
    });

    await check('movement_base_unit_defaults_to_factor_one', async () => {
      const m = await call('POST', '/inventory/movements', { warehouseId: warehouseA.id, movementType: 'RECEIPT', lines: [{ productId: product.id, quantity: 3, direction: 'IN', enteredUnitId: pkg.id }] });
      const line = m.lines[0];
      assert.equal(Number(line.quantityBase), 3);
      assert.equal(Number(line.conversionApplied), 1);
      assert.equal(line.enteredUnitId, pkg.id);
    });

    await check('base_unit_lock_blocks_repointing', async () => {
      await call('PATCH', '/products/' + product.id, { unitId: bag.id }, userA, { companyId: companyA.id, branchId: branchA.id }, 400);
      const reloaded = await call('GET', '/products/' + product.id);
      assert.equal(reloaded.unitId, pkg.id, 'Base unit must remain locked to the original global unit');
    });

    await check('movement_foreign_packaging_reference_rejected', async () => {
      const other = await call('POST', '/products', { code: prefix + '_P2', name: 'Other product', unitId: pkg.id });
      await call('POST', '/inventory/movements', { warehouseId: warehouseA.id, movementType: 'RECEIPT', lines: [{ productId: other.id, quantity: 1, direction: 'IN', productUomId: bagRow.id }] }, userA, { companyId: companyA.id, branchId: branchA.id }, 400);
      await call('POST', '/inventory/movements', { warehouseId: warehouseA.id, movementType: 'RECEIPT', lines: [{ productId: other.id, quantity: 1, direction: 'IN', enteredUnitId: bale.id }] }, userA, { companyId: companyA.id, branchId: branchA.id }, 400);
    });

    await check('movement_requestId_idempotency', async () => {
      const body = { warehouseId: warehouseA.id, movementType: 'RECEIPT', requestId: prefix + '_IDEM', lines: [{ productId: product.id, quantity: 1, direction: 'IN' }] };
      const first = await call('POST', '/inventory/movements', body);
      const second = await call('POST', '/inventory/movements', body);
      assert.equal(second.id, first.id, 'Identical requestId returns the same movement');
    });

    await check('permission_denied_without_keys', async () => {
      await call('POST', '/products', { code: prefix + '_DENY', name: 'Denied', unitId: pkg.id }, deniedUser, { companyId: companyA.id, branchId: branchA.id }, 403);
      await call('POST', '/inventory/movements', { warehouseId: warehouseA.id, movementType: 'RECEIPT', lines: [{ productId: product.id, quantity: 1, direction: 'IN' }] }, deniedUser, { companyId: companyA.id, branchId: branchA.id }, 403);
      await call('POST', '/inventory/movements', { warehouseId: warehouseA.id, movementType: 'RECEIPT', lines: [{ productId: product.id, quantity: 1, direction: 'IN' }] }, limitedUser, { companyId: companyA.id, branchId: branchA.id }, 403);
    });

    await check('tenant_reference_isolation_on_movement', async () => {
      await call('POST', '/inventory/movements', { warehouseId: warehouseB.id, movementType: 'RECEIPT', lines: [{ productId: product.id, quantity: 1, direction: 'IN' }] }, userA, { companyId: companyA.id, branchId: branchA.id }, 400);
      await call('GET', '/inventory/movements/' + movement.id, undefined, userB, { companyId: companyB.id, branchId: branchB.id }, 404);
      await call('POST', '/inventory/movements', { warehouseId: warehouseA.id, movementType: 'RECEIPT', lines: [{ productId: product.id, quantity: 1, direction: 'IN' }] }, userB, { companyId: companyB.id, branchId: branchB.id }, 400);
      const listed = await call('GET', '/inventory/movements?limit=100', undefined, userB, { companyId: companyB.id, branchId: branchB.id });
      const rows = Array.isArray(listed) ? listed : listed.data || [];
      assert(!rows.some((m) => m.id === movement.id), 'Company B must not list Company A movements');
    });

    await check('unauthenticated_movement_write_rejected', async () => {
      const response = await fetch(BASE + '/inventory/movements', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ warehouseId: warehouseA.id, movementType: 'RECEIPT', lines: [] }) });
      requests.push({ method: 'POST', route: '/inventory/movements', status: response.status, authentication: 'NONE' });
      assert.equal(response.status, 401);
    });

    await check('packaging_proof_not_persisted_on_failure', async () => {
      const before = await db.inventoryMovement.count({ where: { warehouseId: warehouseA.id } });
      await call('POST', '/inventory/movements', { warehouseId: warehouseA.id, movementType: 'RECEIPT', lines: [{ productId: product.id, quantity: 1, direction: 'IN', productUomId: baleRow.id }, { productId: 'PUM_MISSING_PRODUCT', quantity: 1, direction: 'IN' }] }, userA, { companyId: companyA.id, branchId: branchA.id }, 400);
      assert.equal(await db.inventoryMovement.count({ where: { warehouseId: warehouseA.id } }), before, 'Partial multi-line failure must roll back atomically');
    });

    const artifact = {
      status: 'PASS',
      productionMutations: 'NONE',
      runtimeDatabase: runtime.database,
      runtimeDatabaseId: runtime.databaseId,
      sourceBackupFinishedAt: runtime.backupFinishedAt,
      observedAtUtc: new Date().toISOString(),
      observedRoutes: requests,
      checks,
      fixtures: { prefix, productId: product.id, baseRowId: baseRow.id, bagRowId: bagRow.id, baleRowId: baleRow.id, warehouseAId: warehouseA.id, companyAId: companyA.id, companyBId: companyB.id },
      cleanup: 'Fixtures retained only in the disposable runtime database; production is untouched.',
    };
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, 'runtime-proof.json');
    fs.writeFileSync(out, JSON.stringify(artifact, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'PASS', checks: checks.length, httpRequests: requests.length, artifact: path.relative(root, out), runtimeDatabase: runtime.database, productionMutations: 'NONE' }));
  } catch (error) {
    results.status = 'FAIL';
    console.error(JSON.stringify({ status: 'FAIL', error: error.name, message: String(error.message).replace(/(password|user|uid|pwd)=[^;\s]+/gi, '$1=REDACTED'), completedChecks: checks.length }));
    process.exitCode = 1;
  } finally {
    api.kill();
    await db.$disconnect().catch(() => {});
  }
  if (results.status === 'FAIL') process.exitCode = 1;
}
main().catch((error) => { console.error(JSON.stringify({ status: 'FAIL', error: error.name, message: String(error.message).replace(/(password|user|uid|pwd)=[^;\s]+/gi, '$1=REDACTED') })); process.exitCode = 1; });
