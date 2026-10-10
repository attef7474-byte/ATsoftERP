'use strict';
/** Real HTTP + SQL proof. All fixture writes are confined to a guarded disposable restored database. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {PrismaClient,Prisma}=require('@prisma/client'),{PrismaMssql}=require('@prisma/adapter-mssql'),jwt=require('jsonwebtoken');
const root=path.resolve(__dirname,'..'),env=require('dotenv').parse(fs.readFileSync(path.join(root,'.env')));
const runtime=JSON.parse(fs.readFileSync(path.join(root,'.tmp/mwr-runtime.json')));
assert(/^ATsoftERP_MWR_RUNTIME_\d{14}$/.test(runtime.database)&&runtime.candidateApplied,'Disposable candidate database required');
const url=env.DATABASE_URL.replace(/database=[^;]+/i,'database='+runtime.database);
assert(url.includes('database='+runtime.database));
const db=new PrismaClient({adapter:new PrismaMssql(url)});
const stamp=Date.now().toString(),prefix='MWR_'+stamp;
const checks=[],requests=[],created=[];
let context,otherContext,users,role,limitedUser,warehouse,foreignWarehouse,product,spare,machine,component,line;
function token(user){return jwt.sign({sub:user.id,authVersion:user.authVersion||0},env.JWT_SECRET,{expiresIn:'2h'});}
async function call(method,route,body,user=users[0],ctx=context,expected=200){
 if(method==='POST' && expected===200)expected=201;
 const endpoint=new URL('http://127.0.0.1:4311/api/v1'+route);assert.equal(endpoint.port,'4311');assert.equal(endpoint.hostname,'127.0.0.1');
 const response=await fetch(endpoint,{method,headers:{'content-type':'application/json',authorization:'Bearer '+token(user),
  'x-active-company-id':ctx.companyId,'x-active-branch-id':ctx.branchId},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const json=await response.json();requests.push({method,route,status:response.status});
 if(response.status!==expected) throw new Error(method+' '+route+' expected '+expected+' received '+response.status+' '+JSON.stringify(json));
 return json.data===undefined?json:json.data;
}
async function check(name,fn){await fn();checks.push({name,result:'PASS'});console.log(JSON.stringify({check:name,result:'PASS'}));}
async function createExecution(data,user=users[0],ctx=context){const e=await call('POST','/maintenance/tasks',data,user,ctx,201);created.push(e.id);return e;}
async function start(e,participants=[users[0].id]){return call('PATCH','/maintenance/tasks/'+e.id+'/start',{participantUserIds:participants});}
async function complete(e,extra={}){return call('PATCH','/maintenance/tasks/'+e.id+'/complete',{workPerformed:'Verified maintenance work',...extra});}
function part(key,extra={}){return {clientRequestId:prefix+'_'+key,productId:product.id,warehouseId:warehouse.id,quantity:1,usageType:'CONSUMED',...extra};}
async function snapshot(executionId){
 return JSON.parse(JSON.stringify({
  task:await db.maintenanceTask.findUnique({where:{id:executionId}}),
  sessions:await db.maintenanceExecutionSession.findMany({where:{executionId},orderBy:{id:'asc'}}),
  usages:await db.maintenanceExecutionPartUsage.findMany({where:{executionId},orderBy:{id:'asc'}}),
  physical:await db.inventoryBalance.findMany({where:{warehouseId:warehouse.id,productId:product.id},orderBy:{id:'asc'}}),
  monetary:await db.inventoryValuationBalance.findMany({where:{warehouseId:warehouse.id,productId:product.id},orderBy:{id:'asc'}}),
  movements:await db.inventoryMovement.count({where:{warehouseId:warehouse.id}}),
  ledger:await db.operationalCostTransaction.count({where:{companyId:context.companyId}}),
  source:await db.maintenanceWorkOrder.findMany({where:{executions:{some:{id:executionId}}}}),
  downtime:await db.downtimeLog.findMany({where:{executionId},orderBy:{id:'asc'}}),
  audit:await db.auditLog.count({where:{entityId:executionId}}),
 }));
}
async function main(){
 await db.$connect();assert.equal((await db.$queryRawUnsafe('SELECT DB_NAME() AS name'))[0].name,runtime.database);
 line=await db.productionLine.findFirstOrThrow({where:{status:'ACTIVE',deletedAt:null,branch:{status:'ACTIVE',deletedAt:null},company:{status:'ACTIVE',deletedAt:null}},include:{company:true}});
 context={companyId:line.companyId,branchId:line.branchId};
 if(!line.company.operationalCurrencyCode)await db.company.update({where:{id:line.companyId},data:{operationalCurrencyCode:'SAR'}});
 const currency=line.company.operationalCurrencyCode||'SAR';
 const companyB=await db.company.create({data:{code:prefix+'_B',name:'Disposable tenant B',operationalCurrencyCode:currency}});
 const branchB=await db.branch.create({data:{companyId:companyB.id,code:prefix+'_B',name:'Disposable branch B'}});
 otherContext={companyId:companyB.id,branchId:branchB.id};
 const branchA2=await db.branch.create({data:{companyId:context.companyId,code:prefix+'_A2',name:'Disposable unauthorized branch'}});
 const keys=['maintenance-task:create','maintenance-task:read','maintenance-task:update','maintenance-task:start','maintenance-task:complete','maintenance-task:cancel','maintenance-task:assign','maintenance-task:registerHistorical','maintenance-task:parts.issue','maintenance-task:downtime.close','maintenance-request:create','maintenance-request:read','maintenance-request:update','maintenance-work-order:create','maintenance-work-order:read','maintenance-work-order:update'];
 for(const key of keys){const split=key.indexOf(':');await db.permission.upsert({where:{key},update:{},create:{key,module:key.slice(0,split),action:key.slice(split+1)}});}
 const perms=await db.permission.findMany({where:{key:{in:keys}}});
 role=await db.role.create({data:{code:prefix+'_ENGINEER',name:'Disposable execution engineer',permissions:{create:perms.map(p=>({permissionId:p.id}))}}});
 const limited=await db.role.create({data:{code:prefix+'_LIMITED',name:'Disposable limited engineer',permissions:{create:perms.filter(p=>!['maintenance-task:parts.issue','maintenance-task:downtime.close'].includes(p.key)).map(p=>({permissionId:p.id}))}}});
 users=[];
 for(let i=0;i<4;i++){const ctx=i===3?otherContext:context;users.push(await db.user.create({data:{name:'MWR Engineer '+(i+1),email:prefix+'_'+i+'@proof.invalid',passwordHash:crypto.randomBytes(32).toString('hex'),...ctx,roles:{create:{roleId:role.id}}}}));}
 limitedUser=await db.user.create({data:{name:'MWR Limited Engineer',email:prefix+'_limited@proof.invalid',passwordHash:crypto.randomBytes(32).toString('hex'),...context,roles:{create:{roleId:limited.id}}}});
 const denied=await db.user.create({data:{name:'MWR Denied Engineer',email:prefix+'_denied@proof.invalid',passwordHash:crypto.randomBytes(32).toString('hex'),...context}});
 machine=await db.machine.create({data:{code:prefix+'_M',name:'MWR Test Machine',...context,productionLineId:line.id}});
 const otherMachine=await db.machine.create({data:{code:prefix+'_M2',name:'MWR Other Machine',...context}});
 component=await db.machineComponent.create({data:{code:prefix+'_C',name:'MWR Component',componentType:'ASSEMBLY',machineId:machine.id}});
 const badComponent=await db.machineComponent.create({data:{code:prefix+'_C2',name:'MWR Other Component',componentType:'ASSEMBLY',machineId:otherMachine.id}});
 warehouse=await db.warehouse.create({data:{code:prefix+'_W',name:'MWR Valued Stock',...context,warehouseType:'SPARE_PARTS'}});
 foreignWarehouse=await db.warehouse.create({data:{code:prefix+'_WB',name:'MWR Foreign Stock',...otherContext,warehouseType:'SPARE_PARTS'}});
 product=await db.product.create({data:{code:prefix+'_P',name:'MWR Inventory Item',unit:'pcs'}});
 spare=await db.sparePart.create({data:{code:prefix+'_SP',name:'MWR Spare Part',productId:product.id}});
 await db.inventoryBalance.create({data:{warehouseId:warehouse.id,productId:product.id,quantity:100,quantityBase:new Prisma.Decimal(100)}});
 await db.inventoryValuationPolicy.create({data:{companyId:context.companyId,warehouseId:warehouse.id,status:'ACTIVE',currencyCode:currency,activatedAt:new Date(),initializedAt:new Date()}});
 await db.inventoryValuationBalance.create({data:{companyId:context.companyId,warehouseId:warehouse.id,productId:product.id,averageUnitCost:new Prisma.Decimal(10),inventoryValue:new Prisma.Decimal(1000)}});
 await db.sparePartConditionBalance.create({data:{sparePartId:spare.id,sparePartKey:spare.id,productId:product.id,warehouseId:warehouse.id,warehouseKey:warehouse.id,condition:'NEW',quantity:100,availableQuantity:100}});
 let request,execution,order,planned,rollbackExecution;
 await check('request_without_parts_authenticated_creator_and_generated_title',async()=>{
  request=await call('POST','/maintenance/requests',{machineId:machine.id,productionLineId:line.id,machineComponentId:component.id,type:'CORRECTIVE',description:'MWR repair request',machineStopped:false},users[0],context,201);
  assert.equal(request.requestedById,users[0].id);assert.equal(request.title,'MWR repair request');
  assert.equal(await db.maintenanceRequestRequiredPart.count({where:{maintenanceRequestId:request.id}}),0);
  assert.equal(await db.downtimeLog.count({where:{requestId:request.id}}),0);
 });
 await check('machine_stop_requires_description',async()=>{
  await call('POST','/maintenance/requests',{machineId:machine.id,type:'CORRECTIVE',machineStopped:true},users[0],context,400);
 });
 await check('M5_same_tenant_component_mismatch_is_400',async()=>{
  await call('POST','/maintenance/requests',{machineId:machine.id,machineComponentId:badComponent.id,type:'CORRECTIVE',description:'Mismatch'},users[0],context,400);
 });
 await check('selected_line_cannot_contain_unassigned_machine',async()=>{
  await call('POST','/maintenance/requests',{machineId:otherMachine.id,productionLineId:line.id,type:'CORRECTIVE',description:'Mismatch'},users[0],context,400);
 });
 await check('request_stop_creates_one_canonical_downtime',async()=>{
  request=await call('POST','/maintenance/requests',{machineId:machine.id,productionLineId:line.id,machineComponentId:component.id,type:'CORRECTIVE',description:'MWR stopped machine',machineStopped:true},users[0],context,201);
  const logs=await db.downtimeLog.findMany({where:{requestId:request.id}});assert.equal(logs.length,1);assert.equal(logs[0].machineStopped,true);
 });
 await check('request_execution_team_start',async()=>{
  execution=await createExecution({sourceType:'MAINTENANCE_REQUEST',requestId:request.id});
  await start(execution,[users[0].id,users[1].id]);
  const sessions=await db.maintenanceExecutionSession.findMany({where:{executionId:execution.id}});
  assert.equal(sessions.length,2);assert.equal(+sessions[0].startedAt,+sessions[1].startedAt);
 });
 await check('source_context_frozen_after_execution_and_list_detail_downtime_agree',async()=>{
  await call('PATCH','/maintenance/requests/'+request.id,{machineId:otherMachine.id,machineComponentId:null,productionLineId:null},users[0],context,400);
  const detail=await call('GET','/maintenance/tasks/'+execution.id);
  const list=await call('GET','/maintenance/tasks?requestId='+request.id);
  const item=(Array.isArray(list)?list:list.data).find(e=>e.id===execution.id);
  assert(item);assert.equal(item.downtimeLogs.length,detail.downtimeLogs.length);assert(item.downtimeLogs.length>0);
  assert(Math.abs(item.metrics.downtimeMinutes-detail.metrics.downtimeMinutes)<0.1);
  await call('POST','/maintenance/tasks',{sourceType:'DIRECT',scopeType:'GENERAL',description:'Forbidden identity',createdById:users[1].id},users[0],context,400);
 });
 await check('one_engineer_cannot_start_overlapping_execution',async()=>{
  const e=await createExecution({sourceType:'DIRECT',scopeType:'GENERAL',description:'MWR conflict'});
  await call('PATCH','/maintenance/tasks/'+e.id+'/start',{participantUserIds:[users[0].id]},users[0],context,409);
  assert.equal((await db.maintenanceTask.findUnique({where:{id:e.id}})).status,'PENDING');
  await call('PATCH','/maintenance/tasks/'+e.id+'/cancel',{});
 });
 await check('handoff_does_not_start_successor_or_complete_work_or_close_downtime',async()=>{
  await call('PATCH','/maintenance/tasks/'+execution.id+'/handoff',{workPerformed:'Motor removed',remainingWork:'Install replacement',handoffToUserId:users[2].id});
  assert.equal(await db.maintenanceExecutionSession.count({where:{executionId:execution.id,technicianUserId:users[2].id}}),0);
  assert.equal((await db.maintenanceTask.findUnique({where:{id:execution.id}})).status,'IN_PROGRESS');
  assert.equal(await db.downtimeLog.count({where:{requestId:request.id,endTime:null}}),1);
 });
 await check('late_join_and_early_leave_affect_only_own_participation',async()=>{
  await call('PATCH','/maintenance/tasks/'+execution.id+'/join',{},users[2]);
  await call('PATCH','/maintenance/tasks/'+execution.id+'/leave',{workPerformed:'Inspection complete'},users[1]);
  assert.equal(await db.maintenanceExecutionSession.count({where:{executionId:execution.id,endedAt:null}}),1);
 });
 await check('return_to_service_closes_downtime_while_execution_remains_active',async()=>{
  await call('PATCH','/maintenance/tasks/'+execution.id+'/return-to-service',{});
  assert.equal(await db.downtimeLog.count({where:{requestId:request.id,endTime:null}}),0);
  assert.equal((await db.maintenanceTask.findUnique({where:{id:execution.id}})).status,'IN_PROGRESS');
 });
 await check('request_actual_part_internal_line_usage_and_idempotent_team_issue',async()=>{
  const input=part('request1',{sparePartId:spare.id});
  const usage=await call('POST','/maintenance/tasks/'+execution.id+'/parts',input);
  assert(usage.inventoryMovementId);assert.equal(usage.installedPartId,null);
  const count=await db.inventoryMovement.count({where:{sourceType:'MAINTENANCE_EXECUTION',sourceId:execution.id}});
  await call('POST','/maintenance/tasks/'+execution.id+'/parts',input);
  assert.equal(await db.inventoryMovement.count({where:{sourceType:'MAINTENANCE_EXECUTION',sourceId:execution.id}}),count);
  await call('POST','/maintenance/tasks/'+execution.id+'/parts',{...input,quantity:2},users[0],context,409);
  await call('POST','/maintenance/tasks/'+execution.id+'/parts',part('request2',{sparePartId:spare.id}));
  assert.equal(await db.maintenanceRequestRequiredPart.count({where:{maintenanceRequestId:request.id,sparePartId:spare.id}}),1);
  assert.equal((await db.maintenanceRequestRequiredPart.findFirst({where:{maintenanceRequestId:request.id,sparePartId:spare.id}})).status,'USED');
 });
 await check('team_completion_shared_timestamp_and_canonical_request_completion',async()=>{
  await call('PATCH','/maintenance/tasks/'+execution.id+'/join',{},users[0]);
  await call('PATCH','/maintenance/tasks/'+execution.id+'/complete',{workPerformed:'Final repair'},users[0],context,400);
  await complete(execution,{confirmEndParticipants:true});
  const e=await db.maintenanceTask.findUnique({where:{id:execution.id},include:{sessions:true}});
  assert.equal(e.status,'DONE');
  for(const s of e.sessions.filter(s=>s.endReason==='COMPLETE'))assert.equal(+s.endedAt,+e.completedAt);
  const source=await db.maintenanceRequest.findUnique({where:{id:request.id}});
  assert.equal(source.status,'COMPLETED');assert.equal(+source.endDate,+e.completedAt);
 });
 await check('terminal_sources_excluded_and_rejected_for_new_execution',async()=>{
  await createExecution({sourceType:'DIRECT',scopeType:'GENERAL',description:'MWR available'});
  await call('POST','/maintenance/tasks',{sourceType:'MAINTENANCE_REQUEST',requestId:request.id},users[0],context,400);
  const eligible=await call('GET','/maintenance/requests?executionEligible=true&limit=100');
  assert(!eligible.some(r=>r.id===request.id));
 });
 await check('direct_general_consumption_valuation_and_no_fake_parent',async()=>{
  const e=await createExecution({sourceType:'DIRECT',scopeType:'GENERAL',description:'MWR general workshop work'});await start(e);
  const before=await db.inventoryBalance.findFirst({where:{warehouseId:warehouse.id,productId:product.id}});
  await complete(e,{parts:[part('general')]});
  const after=await db.inventoryBalance.findFirst({where:{warehouseId:warehouse.id,productId:product.id}});
  assert.equal(before.quantity-after.quantity,1);
  const usage=await db.maintenanceExecutionPartUsage.findFirstOrThrow({where:{executionId:e.id},include:{inventoryMovement:{include:{lines:true}}}});
  assert.equal(usage.requiredPartId,null);assert.equal(usage.workOrderPartId,null);assert.equal(usage.installedPartId,null);
  assert.equal(usage.inventoryMovement.lines[0].totalCost.toString(),'10');
  assert.equal(await db.operationalCostTransaction.count({where:{sourceId:usage.inventoryMovement.lines[0].id,eventType:'MATERIAL'}}),1);
 });
 await check('direct_line_scope_without_fake_machine',async()=>{
  const e=await createExecution({sourceType:'DIRECT',scopeType:'PRODUCTION_LINE',productionLineId:line.id,description:'MWR line work'});assert.equal(e.machineId,null);await start(e);await complete(e);
 });
 await check('direct_machine_installation_and_canonical_replacement',async()=>{
  const e=await createExecution({sourceType:'DIRECT',scopeType:'MACHINE',machineId:machine.id,machineComponentId:component.id,description:'MWR installation'});await start(e);
  const installed=await call('POST','/maintenance/tasks/'+e.id+'/parts',part('install',{sparePartId:spare.id,usageType:'INSTALLED'}));
  assert(installed.installedPartId);
  const replaced=await call('POST','/maintenance/tasks/'+e.id+'/parts',part('replace',{sparePartId:spare.id,usageType:'REPLACED',oldInstalledPartId:installed.installedPartId,replacementAction:'NO_REMOVED_PART',noReturnReason:'Disposed in controlled proof'}));
  assert(replaced.replacementHistoryId);
  assert.equal((await db.machineInstalledPart.findUnique({where:{id:installed.installedPartId}})).status,'REMOVED');await complete(e);
 });
 await check('independent_work_order_scopes_and_planned_actual_separation',async()=>{
  order=await call('POST','/maintenance-work-orders',{scopeType:'GENERAL',description:'MWR planned work',parts:[{productId:product.id,quantity:10,unitCost:999}]},users[0],context,201);
  assert.equal(order.requestId,null);assert.equal(order.machineId,null);assert.equal(order.title,'MWR planned work');planned=order.parts[0];
  const e=await createExecution({sourceType:'WORK_ORDER',workOrderId:order.id});await start(e);
  await complete(e,{parts:[part('planned',{quantity:2,workOrderPartId:planned.id}),part('unplanned')]});
  const result=await db.maintenanceWorkOrder.findUnique({where:{id:order.id},include:{parts:true}});
  assert.equal(result.status,'COMPLETED');assert.equal(result.parts[0].quantity,10);assert.equal(result.parts[0].issuedQuantity,2);
  assert.equal(result.actualCost.toString(),'30');
  for(const scope of [{scopeType:'PRODUCTION_LINE',productionLineId:line.id},{scopeType:'MACHINE',machineId:machine.id}]){
   const wo=await call('POST','/maintenance-work-orders',{...scope,description:'MWR scoped order'},users[0],context,201);
   assert.equal(wo.scopeType,scope.scopeType);assert.equal(wo.requestId,null);
  }
 });
 await check('multiple_executions_only_final_sibling_completes_source',async()=>{
  const wo=await call('POST','/maintenance-work-orders',{scopeType:'GENERAL',description:'MWR sibling work'},users[0],context,201);
  const a=await createExecution({sourceType:'WORK_ORDER',workOrderId:wo.id}),b=await createExecution({sourceType:'WORK_ORDER',workOrderId:wo.id});
  await start(a);await complete(a);assert.equal((await db.maintenanceWorkOrder.findUnique({where:{id:wo.id}})).status,'IN_PROGRESS');
  await start(b);await complete(b);assert.equal((await db.maintenanceWorkOrder.findUnique({where:{id:wo.id}})).status,'COMPLETED');
 });
 await check('historical_registration_and_overlap_validation',async()=>{
  const data={sourceType:'DIRECT',scopeType:'GENERAL',description:'MWR historical work',participantUserIds:[users[0].id,users[1].id],
   startedAt:'2026-10-01T08:00:00Z',completedAt:'2026-10-01T09:00:00Z',workPerformed:'Verified historical repair',parts:[part('historical')]};
  const e=await call('POST','/maintenance/tasks/register-historical',data,users[0],context,201);
  assert.equal(e.status,'DONE');assert.equal(e.metrics.elapsedMinutes,60);assert.equal(e.metrics.totalLaborMinutes,120);
  await call('POST','/maintenance/tasks/register-historical',{...data,parts:[]},users[0],context,409);
  await call('POST','/maintenance/tasks/register-historical',{...data,startedAt:data.completedAt,completedAt:data.startedAt},users[0],context,400);
 });
 await check('permission_allow_deny_and_embedded_part_permission',async()=>{
  await call('GET','/maintenance/tasks',undefined,denied,context,403);
  const e=await createExecution({sourceType:'DIRECT',scopeType:'GENERAL',description:'MWR limited'},limitedUser);
  await call('PATCH','/maintenance/tasks/'+e.id+'/start',{},limitedUser);
  await call('PATCH','/maintenance/tasks/'+e.id+'/complete',{workPerformed:'Done',parts:[part('forbidden')]},limitedUser,context,403);
  assert.equal(await db.maintenanceExecutionPartUsage.count({where:{executionId:e.id}}),0);
  await call('PATCH','/maintenance/tasks/'+e.id+'/complete',{workPerformed:'Done'},limitedUser);
 });
 await check('tenant_and_branch_read_edit_reference_and_list_isolation',async()=>{
  await call('GET','/maintenance/tasks/'+execution.id,undefined,users[3],otherContext,404);
  await call('PATCH','/maintenance/tasks/'+execution.id,{description:'Foreign edit'},users[3],otherContext,404);
  await call('POST','/maintenance/tasks',{sourceType:'MAINTENANCE_REQUEST',requestId:request.id},users[3],otherContext,404);
  const listed=await call('GET','/maintenance/tasks?limit=100',undefined,users[3],otherContext);
  assert(!listed.some(e=>created.includes(e.id)));
  const participants=await call('GET','/maintenance/tasks/participants?limit=100',undefined,users[3],otherContext);
  assert(!participants.some(p=>users.slice(0,3).some(u=>u.id===p.id)));
  const admin=await db.user.findFirstOrThrow({where:{roles:{some:{role:{code:'SUPER_ADMIN'}}},status:'ACTIVE',deletedAt:null}});
  await call('GET','/maintenance/tasks/'+execution.id,undefined,admin,{companyId:context.companyId,branchId:branchA2.id},404);
 });
 await check('insufficient_stock_completion_rolls_back_without_partial_usage',async()=>{
  const e=await createExecution({sourceType:'DIRECT',scopeType:'GENERAL',description:'MWR insufficient'});await start(e);
  const before=await snapshot(e.id);
  await call('PATCH','/maintenance/tasks/'+e.id+'/complete',{workPerformed:'Done',parts:[part('early'),part('insufficient',{quantity:10000})]},users[0],context,400);
  assert.deepEqual(await snapshot(e.id),before);
  await complete(e);
 });
 await check('ATOMIC_COMPLETION_ROLLBACK_AFTER_SOURCE_AND_DOWNTIME_MUTATIONS',async()=>{
  const wo=await call('POST','/maintenance-work-orders',{scopeType:'MACHINE',machineId:machine.id,description:'MWR late failure'},users[0],context,201);
  rollbackExecution=await createExecution({sourceType:'WORK_ORDER',workOrderId:wo.id});await call('PATCH','/maintenance/tasks/'+rollbackExecution.id+'/start',{machineStopped:true,participantUserIds:[users[0].id,users[1].id]});
  const before=await snapshot(rollbackExecution.id);
  const safeId=rollbackExecution.id;assert(/^[A-Za-z0-9_]+$/.test(safeId));
  await db.$executeRawUnsafe("CREATE TRIGGER [dbo].[MWR_Controlled_Completion_Failure] ON [dbo].[audit_logs] AFTER INSERT AS BEGIN SET NOCOUNT ON; IF EXISTS (SELECT 1 FROM inserted WHERE entity=N'MaintenanceTask' AND action=N'COMPLETE' AND entityId=N'"+safeId+"') THROW 51993, 'Controlled disposable late completion failure', 1; END");
  try{
   await call('PATCH','/maintenance/tasks/'+safeId+'/complete',{workPerformed:'Done',confirmEndParticipants:true,machineReturnedToService:true,parts:[part('latefailure')]},users[0],context,500);
   assert.deepEqual(await snapshot(safeId),before);
  } finally { await db.$executeRawUnsafe('DROP TRIGGER [dbo].[MWR_Controlled_Completion_Failure]'); }
  await complete(rollbackExecution,{confirmEndParticipants:true,machineReturnedToService:true,parts:[part('latefailure')]});
 });
 await check('unauthenticated_precision_foreign_warehouse_session_and_new_link_denial',async()=>{
  const unauth=await fetch('http://127.0.0.1:4311/api/v1/maintenance/tasks');assert.equal(unauth.status,401);
  requests.push({method:'GET',route:'/maintenance/tasks',status:unauth.status,authentication:'NONE'});
  const e=await createExecution({sourceType:'DIRECT',scopeType:'GENERAL',description:'Final real security guards'});await start(e);
  const before=await snapshot(e.id);
  await call('POST','/maintenance/tasks/'+e.id+'/parts',part('precision',{quantity:0.00001}),users[0],context,400);
  await call('POST','/maintenance/tasks/'+e.id+'/parts',part('foreign-warehouse',{warehouseId:foreignWarehouse.id}),users[0],context,404);
  const otherSession=await db.maintenanceExecutionSession.findFirstOrThrow({where:{executionId:{not:e.id}}});
  await call('POST','/maintenance/tasks/'+e.id+'/parts',part('foreign-session',{executionSessionId:otherSession.id}),users[0],context,404);
  assert.deepEqual(await snapshot(e.id),before);
  const independent=await call('POST','/maintenance-work-orders',{scopeType:'GENERAL',description:'Immutable new source link'},users[0],context,201);
  await call('PATCH','/maintenance-work-orders/'+independent.id,{requestId:request.id},users[0],context,400);
  assert.equal((await db.maintenanceWorkOrder.findUniqueOrThrow({where:{id:independent.id}})).requestId,null);
  await complete(e);
 });
 const artifact={status:'PASS',database:runtime.database,databaseId:runtime.databaseId,productionMutations:'NONE',observedAtUtc:new Date().toISOString(),checks,requests,
  fixtures:{prefix,context,otherContext,users:users.map(u=>({id:u.id,name:u.name})),machineId:machine.id,componentId:component.id,warehouseId:warehouse.id,productId:product.id,sparePartId:spare.id,requestId:request.id,executionId:execution.id,workOrderId:order.id,createdExecutionIds:created},
  cleanup:'Fixtures retained only in disposable database for browser proof; no production cleanup required.'};
 const output=path.join(root,'docs/proofs/maintenance-workflow-redesign/runtime-proof.json');
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(artifact,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',checks:checks.length,httpRequests:requests.length,artifact:path.relative(root,output)}));
}
main().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.name,message:String(error.message).replace(/(password|user|uid|pwd)=[^;\s]+/gi,'$1=REDACTED'),completedChecks:checks.length}));process.exitCode=1;}).finally(()=>db.$disconnect());
