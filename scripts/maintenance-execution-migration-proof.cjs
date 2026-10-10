/**
 * SQL Server 2016 disposable migration proof. Production is a SELECT-only source.
 * Creates and retains two uniquely named ATsoftERP_MWR_* databases; never deploys,
 * resolves, resets, drops a database, or changes production business/ledger state.
 * Run from repository root: node scripts/maintenance-execution-migration-proof.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const sql = require('mssql');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const migrationName = '20261008020000_maintenance_execution_workflow_redesign';
const migrationPath = path.join(root, 'apps/api/prisma/migrations', migrationName, 'migration.sql');
const tables = ['companies', 'branches', 'production_lines', 'machines', 'machine_components', 'cost_centers', 'users', 'products', 'spare_parts', 'maintenance_requests', 'maintenance_tasks', 'maintenance_work_orders', 'downtime_logs', 'inventory_movements', 'maintenance_request_required_parts', 'maintenance_work_order_parts', 'machine_installed_parts', 'spare_part_replacement_histories'];
function connectionConfig(url) {
  assert(url && url.startsWith('sqlserver://'), 'Configured SQL Server datasource required');
  const parts = url.slice(12).match(/(?:[^;{}]|\{[^}]*\})+/g) || [];
  const host = parts.shift();
  const params = {};
  for (const part of parts) { const i = part.indexOf('='); if (i >= 0) params[part.slice(0,i).toLowerCase()] = part.slice(i+1).replace(/^\{(.*)\}$/, '$1'); }
  const split = host.lastIndexOf(':');
  const config = { server: split > 0 ? host.slice(0,split) : host, database: params.database, user: params.user || params.username, password: params.password, options: { encrypt: params.encrypt === 'true', trustServerCertificate: params.trustservercertificate === 'true' }, pool: { max: 3, min: 0 }, requestTimeout: 120000 };
  if (split > 0) config.port = Number(host.slice(split+1));
  return config;
}
function ident(value) { assert(/^[A-Za-z_][A-Za-z0-9_]*$/.test(value), 'Unsafe SQL identifier'); return `[${value}]`; }
async function query(pool, text, params = {}) { const req = pool.request(); for (const [name,value] of Object.entries(params)) req.input(name,value); return req.query(text); }
async function scalar(pool, text, params) { const r = await query(pool,text,params); return Object.values(r.recordset[0])[0]; }
const results = [];
async function pass(name, fn) { console.log(JSON.stringify({check:name,state:'RUNNING'})); await fn(); results.push({ name, result: 'PASS' }); }
async function rejects(pool, text, params, numbers = [547,2601,2627]) { let caught; try { await query(pool,text,params); } catch(e) { caught=e; } assert(caught, 'Expected SQL rejection'); assert(numbers.includes(caught.number), `Unexpected SQL error ${caught.number}`); }
async function snapshot(pool) {
  return (await query(pool, `SELECT t.name AS tableName,c.name AS columnName,c.column_id,ty.name AS typeName,c.max_length,c.is_nullable FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE t.schema_id=SCHEMA_ID(N'dbo') ORDER BY t.name,c.column_id; SELECT id,requestId,title,status,assignedToId,startedAt,completedAt,cancelledAt,notes,createdAt,updatedAt FROM dbo.maintenance_tasks ORDER BY id; SELECT id,requestId,machineId,machineComponentId,title,status,createdAt,updatedAt FROM dbo.maintenance_work_orders ORDER BY id; SELECT name,type_desc FROM sys.objects WHERE schema_id=SCHEMA_ID(N'dbo') ORDER BY name;`)).recordsets;
}
async function createClone(master, source, database, collation) {
  assert(/^ATsoftERP_MWR_(PROOF|ROLLBACK)_\d{14}$/.test(database), 'Disposable database name required');
  assert.notEqual(database, source);
  assert(/^[A-Za-z0-9_]+$/.test(collation));
  await query(master, `CREATE DATABASE ${ident(database)} COLLATE ${collation};`);
  const target = await new sql.ConnectionPool({...master.config,database}).connect();
  try {
    for (const table of tables) {
      await query(target, 'SELECT * INTO dbo.'+ident(table)+' FROM '+ident(source)+'.dbo.'+ident(table));
      await query(target, 'ALTER TABLE dbo.'+ident(table)+' ADD CONSTRAINT '+ident(table+'_pkey')+' PRIMARY KEY CLUSTERED (id)');
    }
  } finally { await target.close(); }
}
async function seedHistory(pool) {
  // Production currently has no historical tasks. These disposable-only rows model
  // actual persisted Request/Machine relationships and preserve every pre-migration fact.
  const r = (await query(pool, `SELECT TOP (1) r.id,r.machineId,r.machineComponentId,r.productionLineId FROM dbo.maintenance_requests r JOIN dbo.machines m ON m.id=r.machineId ORDER BY r.id; SELECT TOP (2) id FROM dbo.users WHERE deletedAt IS NULL ORDER BY id; SELECT TOP (1) id FROM dbo.production_lines ORDER BY id; SELECT TOP (1) id FROM dbo.maintenance_work_orders ORDER BY id; SELECT TOP (1) id FROM dbo.products ORDER BY id; SELECT TOP (1) id FROM dbo.inventory_movements ORDER BY id;`)).recordsets;
  assert(r[0][0] && r[1].length >= 2 && r[2][0] && r[3][0] && r[4][0] && r[5][0], 'Production read-only copy lacks reference rows required for realistic proof');
  for (const [id,status,started,completed] of [['MWR_H_PENDING','PENDING',null,null],['MWR_H_ACTIVE','IN_PROGRESS','2026-10-07T08:00:00Z',null],['MWR_H_DONE','COMPLETED','2026-10-07T08:00:00Z','2026-10-07T09:00:00Z']]) {
    await query(pool, `INSERT dbo.maintenance_tasks(id,requestId,title,description,status,assignedToId,startedAt,completedAt,createdAt,updatedAt) VALUES(@id,@request,N'Disposable historical execution proof',N'Persisted task fact before migration',@status,@user,@started,@completed,'2026-10-07T07:00:00','2026-10-07T09:00:00');`, { id,request:r[0][0].id,status,user:r[1][0].id,started:started ? new Date(started):null,completed:completed?new Date(completed):null });
  }
  return { request:r[0][0], users:r[1].map(x=>x.id), line:r[2][0].id, workOrder:r[3][0].id, product:r[4][0].id, movement:r[5][0].id };
}
function insertExecution(id, source, scope, refs={}) {
  return { text: `INSERT dbo.maintenance_tasks(id,title,status,createdAt,updatedAt,sourceType,scopeType,requestId,workOrderId,machineId,productionLineId,machineComponentId) VALUES(@id,N'Disposable execution proof',N'IN_PROGRESS',SYSUTCDATETIME(),SYSUTCDATETIME(),@source,@scope,@request,@wo,@machine,@line,@component);`, params:{ id,source,scope,request:refs.request||null,wo:refs.wo||null,machine:refs.machine||null,line:refs.line||null,component:refs.component||null } };
}
async function insertTask(pool,id,source,scope,refs) { const q=insertExecution(id,source,scope,refs); await query(pool,q.text,q.params); }
async function cloneMovement(pool, original, id) {
  const columns=(await query(pool, `SELECT name FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.inventory_movements') AND is_computed=0 AND is_identity=0 ORDER BY column_id`)).recordset.map(x=>x.name);
  await query(pool, `INSERT dbo.inventory_movements(${columns.map(ident).join(',')}) SELECT ${columns.map(c=>c==='id'?'@id':c==='movementNumber'?'@number':ident(c)).join(',')} FROM dbo.inventory_movements WHERE id=@original`, { original,id,number:id });
}
async function main() {
  const environment=dotenv.parse(fs.readFileSync(path.join(root,'.env')));
  const config=connectionConfig(environment.DATABASE_URL);
  const source=config.database;
  assert.equal(source,'ATsoftERP_DB','Unexpected production source; refuse proof until explicitly reviewed');
  const migrationBytes=fs.readFileSync(migrationPath);
  const migration=migrationBytes.toString('utf8');
  const stamp=new Date().toISOString().replace(/\D/g,'').slice(0,14);
  const db=`ATsoftERP_MWR_PROOF_${stamp}`, rollbackDb=`ATsoftERP_MWR_ROLLBACK_${stamp}`;
  const master=await new sql.ConnectionPool({...config,database:'master'}).connect();
  let proof, rollback;
  try {
    const sourcePool=await new sql.ConnectionPool(config).connect();
    const identity=(await query(sourcePool, "SELECT @@SERVERNAME AS server,DB_ID() AS sourceDatabaseId,CONVERT(nvarchar(128),DATABASEPROPERTYEX(DB_NAME(),'Collation')) AS collation")).recordset[0];
    await sourcePool.close();
    assert(identity.collation, 'Source database collation could not be verified');
    await createClone(master,source,db,identity.collation);
    proof=await new sql.ConnectionPool({...config,database:db}).connect();
    const refs=await seedHistory(proof);
    const before=await snapshot(proof);
    await pass('candidate_migration_applies',async()=>{ await proof.request().batch(migration); });
    await pass('historical_backfill_and_fact_preservation',async()=>{
      const tasks=(await query(proof,`SELECT t.*,m.companyId AS expectedCompany,m.branchId AS expectedBranch,r.machineId AS expectedMachine,r.machineComponentId AS expectedComponent,COALESCE(r.productionLineId,m.productionLineId) AS expectedLine FROM dbo.maintenance_tasks t JOIN dbo.maintenance_requests r ON r.id=t.requestId JOIN dbo.machines m ON m.id=r.machineId WHERE t.id LIKE N'MWR_H_%' ORDER BY t.id`)).recordset;
      assert.equal(tasks.length,3);
      for(const row of tasks) { assert.equal(row.sourceType,'MAINTENANCE_REQUEST'); assert.equal(row.scopeType,'MACHINE'); assert.equal(row.machineId,row.expectedMachine); assert.equal(row.companyId,row.expectedCompany); assert.equal(row.branchId,row.expectedBranch); assert.equal(row.machineComponentId,row.expectedComponent); assert.equal(row.productionLineId,row.expectedLine); assert.equal(row.workOrderId,null); assert.equal(row.createdById,null); }
      const after=await snapshot(proof); assert.deepEqual(after[1],before[1]); assert.deepEqual(after[2],before[2]);
      assert.equal(await scalar(proof,'SELECT COUNT(*) FROM dbo.maintenance_execution_sessions'),0);
    });
    await pass('source_and_scope_valid_truth_table',async()=>{
      await insertTask(proof,'MWR_DIRECT_GENERAL','DIRECT','GENERAL');
      await insertTask(proof,'MWR_DIRECT_MACHINE','DIRECT','MACHINE',{machine:refs.request.machineId});
      await insertTask(proof,'MWR_DIRECT_LINE','DIRECT','PRODUCTION_LINE',{line:refs.line});
      await insertTask(proof,'MWR_REQUEST','MAINTENANCE_REQUEST','MACHINE',{request:refs.request.id,machine:refs.request.machineId});
      await insertTask(proof,'MWR_WORK_ORDER','WORK_ORDER','GENERAL',{wo:refs.workOrder});
    });
    await pass('invalid_source_combinations_reject',async()=>{
      const cases=[['DIRECT',{request:refs.request.id}],['DIRECT',{wo:refs.workOrder}],['MAINTENANCE_REQUEST',{}],['WORK_ORDER',{}],['WORK_ORDER',{request:refs.request.id,wo:refs.workOrder}],['MAINTENANCE_REQUEST',{request:refs.request.id,wo:refs.workOrder}],['UNKNOWN',{}]];
      for(let i=0;i<cases.length;i++) { const q=insertExecution(`MWR_BAD_SOURCE_${i}`,cases[i][0],'GENERAL',cases[i][1]); await rejects(proof,q.text,q.params); }
    });
    await pass('invalid_scope_combinations_reject',async()=>{
      const cases=[['MACHINE',{}],['PRODUCTION_LINE',{}],['PRODUCTION_LINE',{line:refs.line,machine:refs.request.machineId}],['GENERAL',{machine:refs.request.machineId}],['GENERAL',{line:refs.line}],['UNKNOWN',{}]];
      for(let i=0;i<cases.length;i++) { const q=insertExecution(`MWR_BAD_SCOPE_${i}`,'DIRECT',cases[i][0],cases[i][1]); await rejects(proof,q.text,q.params); }
    });
    await pass('work_order_scope_backfill_and_checks',async()=>{
      assert.equal(await scalar(proof,`SELECT COUNT(*) FROM dbo.maintenance_work_orders WHERE (machineId IS NULL AND scopeType<>N'GENERAL') OR (machineId IS NOT NULL AND scopeType<>N'MACHINE')`),0);
      await rejects(proof,`UPDATE dbo.maintenance_work_orders SET scopeType=N'PRODUCTION_LINE',productionLineId=NULL WHERE id=@wo`,{wo:refs.workOrder});
      await query(proof,`UPDATE dbo.maintenance_work_orders SET scopeType=N'PRODUCTION_LINE',productionLineId=@line,machineId=NULL,machineComponentId=NULL WHERE id=@wo`,{line:refs.line,wo:refs.workOrder});
      await query(proof,`UPDATE dbo.maintenance_work_orders SET scopeType=N'MACHINE',machineId=@machine WHERE id=@wo`,{machine:refs.request.machineId,wo:refs.workOrder});
      await query(proof,`UPDATE dbo.maintenance_work_orders SET scopeType=N'GENERAL',machineId=NULL,productionLineId=NULL,machineComponentId=NULL WHERE id=@wo`,{wo:refs.workOrder});
    });
    const sessionInsert=`INSERT dbo.maintenance_execution_sessions(id,executionId,technicianUserId,startedAt,updatedAt) VALUES(@id,@execution,@user,'2026-10-08T08:00:00',SYSUTCDATETIME())`;
    await pass('simultaneous_team_sessions',async()=>{
      await query(proof,sessionInsert,{id:'MWR_S_A',execution:'MWR_DIRECT_GENERAL',user:refs.users[0]});
      await query(proof,sessionInsert,{id:'MWR_S_B',execution:'MWR_DIRECT_GENERAL',user:refs.users[1]});
      assert.equal(await scalar(proof,`SELECT COUNT(*) FROM dbo.maintenance_execution_sessions WHERE executionId=N'MWR_DIRECT_GENERAL' AND endedAt IS NULL`),2);
    });
    await pass('same_engineer_active_twice_rejects',async()=>{
      await rejects(proof,sessionInsert,{id:'MWR_S_DUP_SAME',execution:'MWR_DIRECT_GENERAL',user:refs.users[0]});
      await rejects(proof,sessionInsert,{id:'MWR_S_DUP_OTHER',execution:'MWR_DIRECT_MACHINE',user:refs.users[0]});
    });
    await pass('handoff_and_sequential_continuation',async()=>{
      await query(proof,`UPDATE dbo.maintenance_execution_sessions SET endedAt='2026-10-08T09:00:00',endReason=N'HANDOFF',handoffToUserId=@user,workPerformed=N'First engineer work',remainingWork=N'Continuation required' WHERE id=N'MWR_S_A'`,{user:refs.users[1]});
      await query(proof,sessionInsert,{id:'MWR_S_A_NEXT',execution:'MWR_DIRECT_MACHINE',user:refs.users[0]});
      assert.equal(await scalar(proof,`SELECT status FROM dbo.maintenance_tasks WHERE id=N'MWR_DIRECT_GENERAL'`),'IN_PROGRESS');
      assert.equal(await scalar(proof,`SELECT COUNT(*) FROM dbo.maintenance_execution_sessions WHERE id=N'MWR_S_A' AND endReason=N'HANDOFF' AND handoffToUserId=@user`,{user:refs.users[1]}),1);
    });
    await pass('session_chronology_and_fk_reject',async()=>{
      await rejects(proof,`UPDATE dbo.maintenance_execution_sessions SET endedAt='2026-10-08T07:00:00',endReason=N'LEAVE' WHERE id=N'MWR_S_B'`);
      await rejects(proof,sessionInsert,{id:'MWR_S_BAD_USER',execution:'MWR_DIRECT_GENERAL',user:'MWR_MISSING_USER'});
      await rejects(proof,sessionInsert,{id:'MWR_S_BAD_TASK',execution:'MWR_MISSING_TASK',user:refs.users[0]});
    });
    const usageInsert=`INSERT dbo.maintenance_execution_part_usages(id,executionId,executionSessionId,productId,quantity,usageType,inventoryMovementId,recordedByUserId,usedAt,clientRequestId,requestFingerprint,updatedAt) VALUES(@id,@execution,@session,@product,@qty,@type,@movement,@user,SYSUTCDATETIME(),@key,@fingerprint,SYSUTCDATETIME())`;
    const usage=(id,movement,session=null)=>({id,execution:'MWR_DIRECT_GENERAL',session,product:refs.product,qty:1,type:'CONSUMED',movement,user:refs.users[0],key:id,fingerprint:'a'.repeat(64)});
    await pass('execution_team_usage_without_request_or_work_order',async()=>{
      await cloneMovement(proof,refs.movement,'MWR_MOV_TEAM'); await query(proof,usageInsert,usage('MWR_USAGE_TEAM','MWR_MOV_TEAM'));
      assert.equal(await scalar(proof,`SELECT COUNT(*) FROM dbo.maintenance_execution_part_usages WHERE id=N'MWR_USAGE_TEAM' AND executionSessionId IS NULL AND requiredPartId IS NULL AND workOrderPartId IS NULL`),1);
    });
    await pass('session_attributed_usage',async()=>{
      await cloneMovement(proof,refs.movement,'MWR_MOV_SESSION'); await query(proof,usageInsert,usage('MWR_USAGE_SESSION','MWR_MOV_SESSION','MWR_S_B'));
    });
    await pass('usage_idempotency_movement_quantity_type_and_fk_checks',async()=>{
      await rejects(proof,usageInsert,{...usage('MWR_USAGE_DUP_MOV','MWR_MOV_TEAM')});
      await cloneMovement(proof,refs.movement,'MWR_MOV_DUP_KEY'); await rejects(proof,usageInsert,{...usage('MWR_USAGE_DUP_KEY','MWR_MOV_DUP_KEY'),key:'MWR_USAGE_TEAM'});
      await rejects(proof,usageInsert,{...usage('MWR_USAGE_BAD_QTY','MWR_MOV_DUP_KEY'),qty:0});
      await rejects(proof,usageInsert,{...usage('MWR_USAGE_BAD_TYPE','MWR_MOV_DUP_KEY'),type:'UNKNOWN'});
      await rejects(proof,usageInsert,{...usage('MWR_USAGE_BAD_PRODUCT','MWR_MOV_DUP_KEY'),product:'MWR_MISSING_PRODUCT'});
    });
    await pass('shared_team_completion_timestamp',async()=>{
      await query(proof,`BEGIN TRAN; DECLARE @done datetime2='2026-10-08T10:00:00'; UPDATE dbo.maintenance_execution_sessions SET endedAt=@done,endReason=N'COMPLETE' WHERE executionId=N'MWR_DIRECT_GENERAL' AND endedAt IS NULL; UPDATE dbo.maintenance_tasks SET startedAt='2026-10-08T08:00:00',completedAt=@done,status=N'COMPLETED' WHERE id=N'MWR_DIRECT_GENERAL'; COMMIT;`);
      assert.equal(await scalar(proof,`SELECT COUNT(*) FROM dbo.maintenance_execution_sessions s JOIN dbo.maintenance_tasks t ON t.id=s.executionId WHERE s.endReason=N'COMPLETE' AND s.endedAt<>t.completedAt`),0);
    });
    await pass('usage_transaction_atomic_rollback',async()=>{
      const count=await scalar(proof,'SELECT COUNT(*) FROM dbo.maintenance_execution_part_usages');
      let error; try { await query(proof,`BEGIN TRY BEGIN TRAN; UPDATE dbo.maintenance_tasks SET notes=N'Must roll back' WHERE id=N'MWR_DIRECT_MACHINE'; ${usageInsert}; THROW 51992, 'Controlled disposable transaction failure', 1; COMMIT; END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH`,{...usage('MWR_USAGE_ROLLBACK','MWR_MOV_DUP_KEY'),execution:'MWR_DIRECT_MACHINE'}); }catch(e){error=e;}
      assert.equal(error?.number,51992); assert.equal(await scalar(proof,'SELECT COUNT(*) FROM dbo.maintenance_execution_part_usages'),count);
      assert.equal(await scalar(proof,`SELECT notes FROM dbo.maintenance_tasks WHERE id=N'MWR_DIRECT_MACHINE'`),null);
    });
    const metadata=(await query(proof,`SELECT name,is_disabled,is_not_trusted FROM sys.check_constraints WHERE parent_object_id IN(OBJECT_ID(N'dbo.maintenance_tasks'),OBJECT_ID(N'dbo.maintenance_work_orders'),OBJECT_ID(N'dbo.maintenance_execution_sessions'),OBJECT_ID(N'dbo.maintenance_execution_part_usages')) ORDER BY name; SELECT i.name,i.is_unique,i.is_disabled,i.has_filter,i.filter_definition FROM sys.indexes i WHERE i.name=N'maintenance_execution_sessions_one_active_technician_key'; SELECT name,is_disabled,is_not_trusted,delete_referential_action_desc,update_referential_action_desc FROM sys.foreign_keys WHERE name LIKE N'maintenance_execution_%' OR name LIKE N'maintenance_tasks_%' OR name=N'downtime_logs_executionId_fkey' ORDER BY name;`)).recordsets;
    await pass('trusted_enabled_constraint_and_index_metadata',async()=>{ assert.equal(metadata[0].length,10); assert(metadata[0].every(x=>!x.is_disabled&&!x.is_not_trusted)); assert.equal(metadata[1].length,1); assert(metadata[1][0].is_unique && metadata[1][0].has_filter && !metadata[1][0].is_disabled); assert(metadata[2].every(x=>!x.is_disabled&&!x.is_not_trusted&&x.delete_referential_action_desc==='NO_ACTION'&&x.update_referential_action_desc==='NO_ACTION')); });
    await createClone(master,source,rollbackDb,identity.collation);
    rollback=await new sql.ConnectionPool({...config,database:rollbackDb}).connect(); await seedHistory(rollback);
    const rollbackBefore=await snapshot(rollback);
    await pass('ATOMIC_ROLLBACK',async()=>{
      const failed=migration.replace('-- MAINTENANCE_EXECUTION_MIGRATION_COMMIT (late-failure proof injection point)',`THROW 51991, 'Controlled late disposable migration failure', 1;`);
      let error; try{await rollback.request().batch(failed);}catch(e){error=e;}
      assert.equal(error?.number,51991); assert.deepEqual(await snapshot(rollback),rollbackBefore);
      assert.equal(await scalar(rollback,`SELECT COUNT(*) FROM sys.tables WHERE name IN(N'maintenance_execution_sessions',N'maintenance_execution_part_usages')`),0);
    });
    const artifact={ status:'PASS', productionMutations:'NONE', sourceDatabase:source, server:identity.server, sourceDatabaseId:identity.sourceDatabaseId, proofDatabase:db, rollbackDatabase:rollbackDb, observedAtUtc:new Date().toISOString(), migration:{name:migrationName,bytes:migrationBytes.length,sha256:crypto.createHash('sha256').update(migrationBytes).digest('hex'),lineEndings:migration.includes('\r\n')?'CRLF':'LF'}, historicalFixtureRows:3, actualProductionHistoricalTasks:before[1].length-3, results, metadata, limitations:['This proves migration and structural invariants, not HTTP inventory posting. InventoryMovement fixture copies are confined to disposable databases.','The disposable structural clone contains affected/reference tables only; no production data or ledger mutation occurred.']};
    const out=path.join(root,'docs/proofs/maintenance-workflow-redesign/migration-proof.json'); fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,JSON.stringify(artifact,null,2)+'\n');
    console.log(JSON.stringify({status:artifact.status,proofDatabase:db,rollbackDatabase:rollbackDb,checks:results.length,artifact:path.relative(root,out),ATOMIC_ROLLBACK:'PASS',productionMutations:'NONE'}));
  } finally { if(proof) await proof.close(); if(rollback) await rollback.close(); await master.close(); }
}
main().catch(e=>{ console.error(JSON.stringify({status:'FAIL',error:e.name,sqlNumber:e.number||null,lineNumber:e.lineNumber||null,message:String(e.message).replace(/(password|user|uid|pwd)=[^;\s]+/gi,'$1=REDACTED')})); process.exitCode=1; });
