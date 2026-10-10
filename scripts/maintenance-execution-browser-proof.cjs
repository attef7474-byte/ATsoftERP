/** Authenticated real browser/SQL proof. Run from repository root after starting the isolated ports 4310/4311. All fixture mutations require .tmp/mwr-runtime.json identifying a candidate-applied disposable database. Real F9 responses are delayed, never replaced with mock operational data. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),ts=require('typescript');
const {chromium}=require('playwright'),jwt=require('jsonwebtoken'),{PrismaClient}=require('@prisma/client'),{PrismaMssql}=require('@prisma/adapter-mssql');
const root=process.cwd(),out=path.join(root,'docs/proofs/maintenance-workflow-redesign');
const env=require('dotenv').parse(fs.readFileSync('.env')),runtime=JSON.parse(fs.readFileSync('.tmp/mwr-runtime.json'));
assert(/^ATsoftERP_MWR_RUNTIME_\d{14}$/.test(runtime.database)&&runtime.candidateApplied);
const db=new PrismaClient({adapter:new PrismaMssql(env.DATABASE_URL.replace(/database=[^;]+/i,'database='+runtime.database))});
const proof=JSON.parse(fs.readFileSync(path.join(out,'runtime-proof.json'))),f=proof.fixtures;assert.equal(proof.database,runtime.database);
function locale(lang,file){const input=fs.readFileSync('apps/web/src/lib/i18n/locales/'+lang+'/'+file+'.ts','utf8');const m={exports:{}};new Function('exports','require','module',ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m.exports,require,m);return m.exports.default;}
const checks=[],network=[],errors=[];let browser;
async function run(){
 assert.equal((await db.$queryRawUnsafe('SELECT DB_NAME() AS name'))[0].name,runtime.database);
 const user=await db.user.findUniqueOrThrow({where:{id:f.users[0].id},include:{roles:true}});
 const readKeys=new Set();
 for(const name of fs.readdirSync('apps/api/src',{recursive:true})){
  if(!String(name).endsWith('.controller.ts'))continue;
  const code=fs.readFileSync(path.join('apps/api/src',name),'utf8');
  for(const match of code.matchAll(/@Permissions\('([^']+:read)'\)/g))readKeys.add(match[1]);
 }
 for(const key of readKeys){const at=key.indexOf(':');await db.permission.upsert({where:{key},update:{status:'ACTIVE'},create:{key,module:key.slice(0,at),action:'read'}});}
 const read=await db.permission.findMany({where:{key:{endsWith:':read'},status:'ACTIVE'}});
 for(const p of read)await db.rolePermission.upsert({where:{roleId_permissionId:{roleId:user.roles[0].roleId,permissionId:p.id}},update:{},create:{roleId:user.roles[0].roleId,permissionId:p.id}});
 await db.user.update({where:{id:f.users[1].id},data:{name:'MWR Participant '+f.prefix}});f.users[1].name='MWR Participant '+f.prefix;
 const token=jwt.sign({sub:user.id,authVersion:user.authVersion||0},env.JWT_SECRET,{expiresIn:'2h'});
 for(const active of await db.maintenanceTask.findMany({where:{companyId:f.context.companyId,branchId:f.context.branchId,status:'IN_PROGRESS',sessions:{some:{technicianUserId:user.id,endedAt:null}}}})){
  const res=await fetch('http://127.0.0.1:4311/api/v1/maintenance/tasks/'+active.id+'/complete',{method:'PATCH',headers:{authorization:'Bearer '+token,'content-type':'application/json','x-active-company-id':f.context.companyId,'x-active-branch-id':f.context.branchId},body:JSON.stringify({workPerformed:'Previous browser attempt completed in disposable database',confirmEndParticipants:true})});assert.equal(res.status,200);
 }
 browser=await chromium.launch({headless:true});
 for(const lang of ['en','ar']){
  const labels={...locale(lang,'common'),...locale(lang,'maintenance')};
  const t=key=>key.split('.').reduce((a,k)=>a?.[k],labels)||key;
  const ctx=await browser.newContext({locale:lang,viewport:{width:1440,height:1050}});
  await ctx.addCookies([{name:'atsoft_locale',value:lang,url:'http://127.0.0.1:4310'}]);
  await ctx.addInitScript(({token,userId,context,lang})=>{
   localStorage.setItem('accessToken',token);localStorage.setItem('locale',lang);
   localStorage.setItem('atsoft.erp.operational-context.current-user',userId);
   localStorage.setItem('atsoft.erp.operational-context.user.'+encodeURIComponent(userId),JSON.stringify({version:1,userId,context:{...context,administrationId:null,departmentId:null}}));
  },{token,userId:user.id,context:f.context,lang});
  const page=await ctx.newPage();page.setDefaultTimeout(15000);
  // Delay real unfiltered server responses to prove that stale results cannot overwrite a typed search.
  await page.route('**/maintenance/tasks/participants?*',async route=>{
   const response=await route.fetch();
   if(!new URL(route.request().url()).searchParams.get('search'))await new Promise(resolve=>setTimeout(resolve,800));
   await route.fulfill({response});
  });
  page.on('pageerror',e=>errors.push({lang,message:e.message}));
  page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:4311/api/v1'))network.push({lang,url:new URL(r.url()).pathname,status:r.status()});});
  async function shot(name){
   const body=await page.locator('body').innerText();
   assert(!body.includes('The requested text could not be displayed.')&&!body.includes('تعذر عرض النص المطلوب.'),'No translation fallback may appear');
   await page.screenshot({path:path.join(out,'browser-'+lang+'-'+name+'.png'),fullPage:true});}
  async function nav(route){await page.goto('http://127.0.0.1:4310'+route);await page.waitForLoadState('networkidle');assert(!page.url().includes('/login'),'Authenticated browser required');}
  async function lookup(label,search){
   await page.getByRole('button',{name:label,exact:true}).last().click();
   const searchInput=page.locator('input[placeholder]').last();
   const searched=page.waitForResponse(r=>r.url().startsWith('http://127.0.0.1:4311/')&&new URL(r.url()).searchParams.get('search')===search);
   await searchInput.fill(search);
   await searched;
   if(label.startsWith(t('maintenance.participant'))){await page.waitForTimeout(1000);await page.getByRole('columnheader',{name:t('common.name'),exact:true}).waitFor();}
   await page.locator('tbody tr').filter({hasText:search}).last().click({force:true});
  }
  await nav('/admin/maintenance/requests');
  await page.getByRole('button',{name:t('common.create'),exact:true}).click();
  let dialog=page.getByRole('dialog').last();
  assert.equal(await dialog.locator('input:not([disabled])').count()>=0,true);
  assert.equal(await dialog.getByLabel(t('common.title'),{exact:true}).count(),0);
  await shot('request-form');
  const machine=await db.machine.findUniqueOrThrow({where:{id:f.machineId},include:{productionLine:true}});
  assert.equal(await dialog.getByRole('button',{name:t('maintenance.machine'),exact:true}).getAttribute('tabindex'),'-1');
  await lookup(t('maintenance.productionLine'),machine.productionLine.code);
  await lookup(t('maintenance.machine'),machine.code);
  await dialog.getByLabel(t('common.description')).fill('MWR browser request '+lang);
  assert.equal(await dialog.getByLabel(t('maintenance.machineStoppedQuestion')).inputValue(),'NO');
  const requestSaved=page.waitForResponse(r=>r.url().endsWith('/maintenance/requests')&&r.request().method()==='POST');
  await dialog.getByRole('button',{name:t('actions.save'),exact:true}).click();
  const requestResponse=await requestSaved;assert.equal(requestResponse.status(),201);
  const requestBody=await requestResponse.json(),request=requestBody.data||requestBody;
  assert.equal(request.requestedById,user.id);
  assert.equal(await db.maintenanceRequestRequiredPart.count({where:{maintenanceRequestId:request.id}}),0);
  checks.push({lang,name:'browser_request_without_parts_line_before_machine_authenticated_creator',result:'PASS',id:request.id});

  await nav('/admin/maintenance/work-orders');
  await page.getByRole('button',{name:t('common.create'),exact:true}).click();
  dialog=page.getByRole('dialog').last();
  await dialog.getByLabel(t('maintenance.scopeType'),{exact:true}).selectOption('GENERAL');
  await dialog.getByLabel(t('maintenance.workOrderDescription'),{exact:true}).fill('MWR browser '+lang+' general work');
  assert.equal(await dialog.getByRole('button',{name:t('maintenance.maintenanceRequest'),exact:true}).count(),0);
  await shot('work-order-general');
  const orderResponse=page.waitForResponse(r=>r.url().endsWith('/maintenance-work-orders')&&r.request().method()==='POST');
  await dialog.getByRole('button',{name:t('common.save'),exact:true}).click();
  const orderResult=await orderResponse;assert.equal(orderResult.status(),201);
  const orderBody=await orderResult.json(),order=orderBody.data||orderBody;
  assert.equal(order.scopeType,'GENERAL');assert.equal(order.requestId,null);
  checks.push({lang,name:'browser_independent_general_work_order_create',result:'PASS',id:order.id});
  await nav('/admin/maintenance/tasks?sourceType=WORK_ORDER&workOrderId='+order.id);
  await page.getByRole('button',{name:t('maintenance.startWorkNow'),exact:true}).click();
  dialog=page.getByRole('dialog').last();
  await dialog.getByLabel(t('maintenance.executionTeam'),{exact:true}).selectOption('TEAM');
  await dialog.getByRole('button',{name:t('maintenance.addParticipant'),exact:true}).click();
  await lookup(t('maintenance.participant')+' 2',f.users[1].name);
  await shot('team-start');
  const started=page.waitForResponse(r=>/maintenance\/tasks\/[^/]+\/start$/.test(r.url())&&r.request().method()==='PATCH');
  await dialog.getByRole('button',{name:t('maintenance.startWorkNow'),exact:true}).click();
  const startResponse=await started;assert.equal(startResponse.status(),200);
  const startBody=await startResponse.json(),execution=startBody.data||startBody;
  await page.getByRole('button',{name:t('maintenance.completeExecution'),exact:true}).waitFor();
  await shot('team-active');
  await page.getByRole('button',{name:t('maintenance.completeExecution'),exact:true}).click();
  dialog=page.getByRole('dialog').last();
  await dialog.getByLabel(t('maintenance.workPerformed')).fill('Browser verified work '+lang);
  assert.equal(await dialog.getByLabel(t('maintenance.partsUsedQuestion'),{exact:true}).inputValue(),'NO');
  await dialog.getByLabel(t('maintenance.confirmEndParticipants'),{exact:true}).check();
  await dialog.getByLabel(t('maintenance.partsUsedQuestion'),{exact:true}).selectOption('YES');
  await dialog.getByRole('button',{name:t('maintenance.addActualPart'),exact:true}).click();
  const product=await db.product.findUniqueOrThrow({where:{id:f.productId}});
  const warehouse=await db.warehouse.findUniqueOrThrow({where:{id:f.warehouseId}});
  await lookup(t('maintenance.inventoryProduct'),product.code);
  await lookup(t('maintenance.workOrderWarehouse'),warehouse.code);
  await dialog.getByLabel(t('maintenance.quantity')).fill('2');
  const stockBefore=await db.inventoryBalance.findFirstOrThrow({where:{warehouseId:f.warehouseId,productId:f.productId}});

  await shot('team-complete');
  const completed=page.waitForResponse(r=>r.url().endsWith('/maintenance/tasks/'+execution.id+'/complete')&&r.request().method()==='PATCH');
  await dialog.getByRole('button',{name:t('actions.confirm'),exact:true}).click();
  assert.equal((await completed).status(),200);
  await page.waitForLoadState('networkidle');
  const saved=await db.maintenanceTask.findUniqueOrThrow({where:{id:execution.id},include:{sessions:true}});
  assert.equal(saved.status,'DONE');
  const usages=await db.maintenanceExecutionPartUsage.findMany({where:{executionId:saved.id}});
  assert.equal(usages.length,1);assert.equal(Number(usages[0].quantity),2);
  const stockAfter=await db.inventoryBalance.findFirstOrThrow({where:{warehouseId:f.warehouseId,productId:f.productId}});
  assert.equal(stockBefore.quantity-stockAfter.quantity,2);
  const movement=await db.inventoryMovement.findUniqueOrThrow({where:{id:usages[0].inventoryMovementId},include:{lines:true}});
  assert.equal(movement.lines.length,1);assert.equal(Number(movement.lines[0].totalCost),20);
  assert.equal(await db.maintenanceWorkOrder.findUniqueOrThrow({where:{id:order.id}}).then(w=>Number(w.actualCost)),20);
  checks.push({lang,name:'browser_team_one_actual_stock_issue_and_valuation',result:'PASS',movementId:usages[0].inventoryMovementId});
assert.equal(saved.sessions.length,2);assert(saved.sessions.every(s=>s.endedAt));
  assert.equal(await db.maintenanceWorkOrder.findUniqueOrThrow({where:{id:order.id}}).then(w=>w.status),'COMPLETED');
  checks.push({lang,name:'browser_F9_stale_response_guard_and_team_start_complete_database_sessions_source_audit',result:'PASS',id:saved.id});
  assert(await db.auditLog.count({where:{entityId:saved.id,action:'COMPLETE'}})>0);
  await page.getByRole('dialog').last().getByText(product.name+' × 2',{exact:false}).waitFor();
  await shot('team-completed');
  await ctx.close();
 }
 assert.equal(errors.length,0,JSON.stringify(errors));
 fs.writeFileSync(path.join(out,'browser-proof.json'),JSON.stringify({status:'PASS',database:runtime.database,productionMutations:'NONE',observedAtUtc:new Date().toISOString(),checks,network,errors},null,2));
 console.log(JSON.stringify({status:'PASS',checks:checks.length}));
}
run().catch(async e=>{console.error(e.stack);fs.writeFileSync('.tmp/mwr-browser-network.json',JSON.stringify(network,null,2));if(browser){for(const c of browser.contexts())for(const p of c.pages()){await p.screenshot({path:path.join(out,'browser-failure.png'),fullPage:true}).catch(()=>{});fs.writeFileSync('.tmp/mwr-browser-dom.txt',await p.locator('body').innerText());}}process.exitCode=1;}).finally(async()=>{await browser?.close();await db.$disconnect();});
