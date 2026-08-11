import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

if (!process.env.SEED_ADMIN_EMAIL) {
  throw new Error('SEED_ADMIN_EMAIL environment variable is required');
}

if (!process.env.SEED_ADMIN_PASSWORD) {
  throw new Error('SEED_ADMIN_PASSWORD environment variable is required');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(__dirname, '..', '..', 'docs', 'screenshots', 'ux1b2a-maintenance-assets-migration');
const WEB = 'http://localhost:3000';
const API = 'http://localhost:4000';
const EMAIL = process.env.SEED_ADMIN_EMAIL;
const PASS = process.env.SEED_ADMIN_PASSWORD;

fs.mkdirSync(SS_DIR, { recursive: true });

const R = { pass: 0, fail: 0, details: [] };
function ok(n) { R.pass++; R.details.push({ n, s: 'PASS' }); console.log(`  PASS: ${n}`); }
function nok(n, m) { R.fail++; R.details.push({ n, s: 'FAIL', m }); console.log(`  FAIL: ${n} - ${m || ''}`); }

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const p = await ctx.newPage();
const cerr = [];
let token;
let contextHeaders = {};
let contextStorage = null;
let userId = '';

const FIXTURES = [];
const stamp = Date.now().toString().slice(-6);

p.on('console', msg => { if (msg.type() === 'error') cerr.push(msg.text().substring(0, 200)); });
p.on('pageerror', e => cerr.push(e.message.substring(0, 200)));

async function ss(name) { try { await p.screenshot({ path: path.join(SS_DIR, name), fullPage: true }); } catch {} }

async function setLocale(locale) {
  await p.evaluate((l) => {
    localStorage.setItem('locale', l);
    document.cookie = `atsoft_locale=${l}; path=/; max-age=31536000`;
  }, locale);
  await p.waitForTimeout(300);
}

async function go(url) {
  try {
    await p.goto(WEB + url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(2000);
    if (token) {
      await p.evaluate((t) => { localStorage.setItem('accessToken', t); }, token);
      if (contextStorage) {
        await p.evaluate((st) => {
          localStorage.setItem(`atsoft.erp.operational-context.user.${encodeURIComponent(st.userId)}`, JSON.stringify(st.record));
          localStorage.setItem('atsoft.erp.operational-context.current-user', st.userId);
        }, contextStorage);
      }
      await p.waitForTimeout(500);
      await p.goto(WEB + url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(2000);
      await p.evaluate((t) => { localStorage.setItem('accessToken', t); }, token);
      if (contextStorage) {
        await p.evaluate((st) => {
          localStorage.setItem(`atsoft.erp.operational-context.user.${encodeURIComponent(st.userId)}`, JSON.stringify(st.record));
          localStorage.setItem('atsoft.erp.operational-context.current-user', st.userId);
        }, contextStorage);
      }
      await p.waitForTimeout(1500);
    }
    try { await p.waitForLoadState('networkidle', { timeout: 5000 }); } catch {}
    await p.waitForTimeout(800);
  } catch (e) { console.log(`  Nav error: ${e.message}`); }
}

async function apiCall(method, pathStr, body, locale) {
  return p.evaluate(async ({ m, pth, b, l, a, t, ch }) => {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}`, ...ch };
    if (l) headers['x-locale'] = l;
    const r = await fetch(a + '/api/v1' + pth, { method: m, headers, body: b ? JSON.stringify(b) : undefined });
    return { status: r.status, body: await r.json() };
  }, { m: method, pth: pathStr, b: body, l: locale, a: API, t: token, ch: contextHeaders });
}

async function openCreateModal(titleText) {
  const clicked = await p.evaluate((tt) => {
    for (const b of document.querySelectorAll('button')) {
      const title = b.getAttribute('title') || b.innerText.trim();
      if ((title === tt) && !b.hasAttribute('disabled')) { b.click(); return true; }
    }
    return false;
  }, titleText);
  await p.waitForTimeout(1200);
  return clicked;
}

async function countInlineErrors() {
  return p.evaluate(() => {
    const errs = document.querySelectorAll('[role="dialog"] p.text-red-600, [role="dialog"] p.text-red-500, main p.text-red-600, main p.text-red-500');
    const focused = document.activeElement?.name || document.activeElement?.id || document.activeElement?.getAttribute('data-field') || '';
    return { count: errs.length, focused };
  });
}

async function clickSave() {
  await p.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      const t = b.innerText.trim();
      if ((t === 'Save' || t === 'حفظ') && !b.hasAttribute('disabled')) { b.click(); break; }
    }
  });
  await p.waitForTimeout(1200);
}

try {
  // ============ LOGIN ============
  console.log('[LOGIN]');
  const lr = await p.evaluate(async ({ a, e, p: pw }) => {
    const r = await fetch(a + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: pw }) });
    return await r.json();
  }, { a: API, e: EMAIL, p: PASS });
  if (!lr.accessToken) throw new Error('Login failed');
  token = lr.accessToken;
  ok('API login');

  const me = await apiCall('GET', '/auth/me', null, 'en');
  userId = me.body?.id || me.body?.data?.id || '';
  if (userId) ok('API /auth/me resolves user id');
  else nok('API /auth/me user id', '');

  const contextsRes = await apiCall('GET', '/auth/contexts', null, 'en');
  const rawContexts = contextsRes.body?.data?.contexts ?? contextsRes.body?.contexts ?? contextsRes.body?.allowedContexts ?? (Array.isArray(contextsRes.body?.data) ? contextsRes.body.data : []);
  const firstContext = Array.isArray(rawContexts) && rawContexts.length > 0 ? rawContexts[0] : null;
  if (firstContext?.companyId) {
    contextHeaders = { 'x-active-company-id': firstContext.companyId };
    if (firstContext.branchId) contextHeaders['x-active-branch-id'] = firstContext.branchId;
    if (firstContext.administrationId) contextHeaders['x-active-administration-id'] = firstContext.administrationId;
    if (firstContext.departmentId) contextHeaders['x-active-department-id'] = firstContext.departmentId;
    contextStorage = { userId, record: { version: 1, userId, context: { companyId: firstContext.companyId, branchId: firstContext.branchId || '', administrationId: firstContext.administrationId || '', departmentId: firstContext.departmentId || '' } } };
    ok('API /auth/contexts returns context');
  } else {
    nok('API /auth/contexts: no context found', JSON.stringify(contextsRes.body).slice(0, 200));
  }

  // ---- Cleanup any UX1B2A leftovers from previous runs (idempotency) ----
  const ASSET_ENDPOINTS = [
    ['machine-categories', 'category'],
    ['machine-parts', 'part'],
    ['machine-components', 'component'],
    ['machine-documents', 'document'],
    ['machines', 'machine'],
  ];
  for (const [ep, type] of ASSET_ENDPOINTS) {
    try {
      const res = await apiCall('GET', `/maintenance/${ep}?search=UX1B2A&limit=100`, null, 'en');
      const rows = res.body?.data ?? (Array.isArray(res.body) ? res.body : []);
      for (const row of rows) {
        const del = await apiCall('DELETE', `/maintenance/${ep}/${row.id}`, null, 'en');
        console.log(`  leftover cleanup ${type} ${row.id}: ${del.status}`);
      }
    } catch (e2) { console.log(`  leftover cleanup ${type}: ${e2.message}`); }
  }

  // ============ API: MACHINE ASSET FIELD-ERROR CONTRACT ============
  console.log('\n[API MACHINE ASSET CONTRACT]');

  // ---- Machines ----
  const machineList = await apiCall('GET', '/maintenance/machines?limit=20', null, 'en');
  const machines = machineList.body?.data ?? [];
  if (Array.isArray(machines)) ok(`GET machines: list (${machines.length})`);
  else nok('GET machines list', JSON.stringify(machineList.body).slice(0, 200));

  const dupMachine = await apiCall('POST', '/maintenance/machines', { name: 'UX1B2A Duplicate Machine', code: machines[0]?.code || 'DUP-MACHINE' }, 'en');
  if (dupMachine.status === 400 && dupMachine.body.errors?.[0]?.field === 'code' && dupMachine.body.errors?.[0]?.code === 'validation.duplicateValue') {
    ok('POST machine: duplicate code -> field error duplicateValue');
  } else {
    nok('POST machine duplicate code', `${dupMachine.status} ${JSON.stringify(dupMachine.body).slice(0, 200)}`);
  }
  const dupMachineAr = await apiCall('POST', '/maintenance/machines', { name: 'UX1B2A Duplicate Machine', code: machines[0]?.code || 'DUP-MACHINE' }, 'ar');
  const arMsg = dupMachineAr.body?.errors?.[0]?.message;
  if (arMsg && !/^[A-Za-z\s]+$/.test(arMsg)) ok('machine duplicate error localized in Arabic');
  else nok('machine duplicate Arabic localization', arMsg || 'none');

  const nfMachine = await apiCall('GET', '/maintenance/machines/nonexistent-id-xyz', null, 'en');
  if (nfMachine.status === 404 && nfMachine.body.messageKey === 'maintenance.machineNotFound') ok('GET machine missing -> messageKey maintenance.machineNotFound');
  else nok('GET machine missing contract', JSON.stringify(nfMachine.body).slice(0, 200));

  // ---- Machine Categories ----
  const catCreate = await apiCall('POST', '/maintenance/machine-categories', { name: `UX1B2A Cat ${stamp}` }, 'en');
  if (catCreate.status === 201 && catCreate.body?.id && catCreate.body?.code) {
    ok(`machine category auto-code: ${catCreate.body.code}`);
    FIXTURES.push({ type: 'category', id: catCreate.body.id });
    const dupCat = await apiCall('POST', '/maintenance/machine-categories', { name: 'Dup Cat', code: catCreate.body.code }, 'en');
    if (dupCat.status === 400 && dupCat.body.errors?.[0]?.field === 'code' && dupCat.body.errors?.[0]?.code === 'validation.duplicateValue') ok('machine category duplicate code -> field error duplicateValue');
    else nok('machine category duplicate code', `${dupCat.status} ${JSON.stringify(dupCat.body).slice(0, 200)}`);
    const nfCat = await apiCall('GET', '/maintenance/machine-categories/nonexistent-id-xyz', null, 'en');
    if (nfCat.status === 404 && nfCat.body.messageKey === 'maintenance.machineCategoryNotFound') ok('GET machine category missing -> messageKey maintenance.machineCategoryNotFound');
    else nok('GET machine category missing contract', JSON.stringify(nfCat.body).slice(0, 200));
  } else {
    nok('machine category create with auto-code', `${catCreate.status} ${JSON.stringify(catCreate.body).slice(0, 200)}`);
  }

  // ---- Machine Parts ----
  const partCreate = await apiCall('POST', '/maintenance/machine-parts', { name: `UX1B2A Pump ${stamp}`, quantity: 5, minStock: 1, unit: 'pcs' }, 'en');
  if (partCreate.status === 201 && partCreate.body?.id && partCreate.body?.code) {
    ok(`machine part auto-code: ${partCreate.body.code}`);
    FIXTURES.push({ type: 'part', id: partCreate.body.id });
    const dupPart = await apiCall('POST', '/maintenance/machine-parts', { name: 'Dup Part', code: partCreate.body.code, unit: 'pcs' }, 'en');
    if (dupPart.status === 400 && dupPart.body.errors?.[0]?.field === 'code' && dupPart.body.errors?.[0]?.code === 'validation.duplicateValue') ok('machine part duplicate code -> field error duplicateValue');
    else nok('machine part duplicate code', `${dupPart.status} ${JSON.stringify(dupPart.body).slice(0, 200)}`);
    const nfPart = await apiCall('GET', '/maintenance/machine-parts/nonexistent-id-xyz', null, 'en');
    if (nfPart.status === 404 && nfPart.body.messageKey === 'maintenance.machinePartNotFound') ok('GET machine part missing -> messageKey maintenance.machinePartNotFound');
    else nok('GET machine part missing contract', JSON.stringify(nfPart.body).slice(0, 200));
    const updPart = await apiCall('PATCH', `/maintenance/machine-parts/${partCreate.body.id}`, { name: `UX1B2A Pump Renamed ${stamp}`, quantity: 7 }, 'en');
    if (updPart.status === 200 && updPart.body?.name?.includes('Renamed') && updPart.body?.id === partCreate.body.id) ok('machine part PATCH updates same record');
    else nok('machine part PATCH', `${updPart.status} ${JSON.stringify(updPart.body).slice(0, 200)}`);
    const badPart = await apiCall('POST', '/maintenance/machine-parts', { name: 'Bad Part', machineId: 'ghost-machine', unit: 'pcs' }, 'en');
    if (badPart.status === 400 && badPart.body.errors?.[0]?.field === 'machineId' && badPart.body.errors?.[0]?.code === 'validation.invalidReference') ok('machine part invalid machineId -> field error invalidReference');
    else nok('machine part invalid machineId', `${badPart.status} ${JSON.stringify(badPart.body).slice(0, 200)}`);
  } else {
    nok('machine part create with auto-code', `${partCreate.status} ${JSON.stringify(partCreate.body).slice(0, 200)}`);
  }

  // ---- Machine Components ----
  const compBad = await apiCall('POST', '/maintenance/machine-components', { code: 'UX-COMP-1', name: 'Bad Comp', componentType: 'MECHANICAL', machineId: 'ghost-machine' }, 'en');
  if (compBad.status === 400 && compBad.body.errors?.[0]?.field === 'machineId' && compBad.body.errors?.[0]?.code === 'validation.invalidReference') ok('machine component invalid machineId -> field error invalidReference');
  else nok('machine component invalid machineId', `${compBad.status} ${JSON.stringify(compBad.body).slice(0, 200)}`);
  const nfComp = await apiCall('GET', '/maintenance/machine-components/nonexistent-id-xyz', null, 'en');
  if (nfComp.status === 404 && nfComp.body.messageKey === 'maintenance.componentNotFound') ok('GET machine component missing -> messageKey maintenance.componentNotFound');
  else nok('GET machine component missing contract', JSON.stringify(nfComp.body).slice(0, 200));

  // ---- Machine Documents ----
  const docBad = await apiCall('POST', '/maintenance/machine-documents', { machineId: 'ghost-machine', title: 'Bad Doc', type: 'PDF', fileUrl: 'https://example.com/x.pdf' }, 'en');
  if (docBad.status === 400 && docBad.body.errors?.[0]?.field === 'machineId' && docBad.body.errors?.[0]?.code === 'validation.invalidReference') ok('machine document invalid machineId -> field error invalidReference');
  else nok('machine document invalid machineId', `${docBad.status} ${JSON.stringify(docBad.body).slice(0, 200)}`);
  const nfDoc = await apiCall('GET', '/maintenance/machine-documents/nonexistent-id-xyz', null, 'en');
  if (nfDoc.status === 404 && nfDoc.body.messageKey === 'maintenance.machineDocumentNotFound') ok('GET machine document missing -> messageKey maintenance.machineDocumentNotFound');
  else nok('GET machine document missing contract', JSON.stringify(nfDoc.body).slice(0, 200));

  // ---- Machine create/edit round trip + audit ----
  const machCreate = await apiCall('POST', '/maintenance/machines', { name: `UX1B2A Lathe ${stamp}`, model: 'T-42', manufacturer: 'UX1B2A' }, 'en');
  if (machCreate.status === 201 && machCreate.body?.id && machCreate.body?.code) {
    ok(`machine create auto-code: ${machCreate.body.code}`);
    FIXTURES.push({ type: 'machine', id: machCreate.body.id });
    const machUpd = await apiCall('PATCH', `/maintenance/machines/${machCreate.body.id}`, { name: `UX1B2A Lathe Renamed ${stamp}` }, 'en');
    if (machUpd.status === 200 && machUpd.body?.name?.includes('Renamed') && machUpd.body?.id === machCreate.body.id) ok('machine PATCH updates same record');
    else nok('machine PATCH', `${machUpd.status} ${JSON.stringify(machUpd.body).slice(0, 200)}`);

    const auditRes = await apiCall('GET', `/audit-logs?entity=Machine&limit=20`, null, 'en');
    const auditRows = auditRes.body?.data ?? (Array.isArray(auditRes.body) ? auditRes.body : auditRes.body?.items ?? []);
    const foundCreate = Array.isArray(auditRows) && auditRows.some((a) => a.entityId === machCreate.body.id && (a.action || '').toUpperCase() === 'CREATE');
    if (foundCreate) ok('audit log records Machine CREATE with entityId');
    else nok('audit log Machine CREATE', JSON.stringify(auditRes.body).slice(0, 200));

    const compCreate = await apiCall('POST', '/maintenance/machine-components', { code: `UX-COMP-${stamp}`, name: `Gearbox ${stamp}`, componentType: 'MECHANICAL', machineId: machCreate.body.id }, 'en');
    if (compCreate.status === 201 && compCreate.body?.id) {
      ok('machine component create against real machine');
      FIXTURES.push({ type: 'component', id: compCreate.body.id });
      const docCreate = await apiCall('POST', '/maintenance/machine-documents', { machineId: machCreate.body.id, title: `Manual ${stamp}`, type: 'PDF', fileUrl: 'https://example.com/manual.pdf' }, 'en');
      if (docCreate.status === 201 && docCreate.body?.id) { ok('machine document create against real machine'); FIXTURES.push({ type: 'document', id: docCreate.body.id }); }
      else nok('machine document create', `${docCreate.status} ${JSON.stringify(docCreate.body).slice(0, 200)}`);
    } else {
      nok('machine component create', `${compCreate.status} ${JSON.stringify(compCreate.body).slice(0, 200)}`);
    }
  } else {
    nok('machine create auto-code', `${machCreate.status} ${JSON.stringify(machCreate.body).slice(0, 200)}`);
  }

  // ============ WEB: EN LTR ============
  console.log('\n[WEB EN LTR]');
  await go('/login');
  await setLocale('en');

  await go('/admin/maintenance/machines');
  let info = await p.evaluate(() => ({ dir: document.documentElement.dir || document.body.getAttribute('dir'), text: document.body.innerText, tr: document.querySelectorAll('table tbody tr').length, table: !!document.querySelector('table') }));
  if (info.dir === 'ltr') ok('Machines EN: dir=ltr');
  else nok('Machines EN: dir', info.dir || 'none');
  if (info.text.includes('Machines')) ok('Machines EN: header translated');
  else nok('Machines EN: header', '');
  if (info.table) ok(`Machines EN: grid rendered (${info.tr} rows)`);
  else nok('Machines EN: grid', '');
  await ss('01-machines-en-ltr.png');

  await go('/admin/maintenance/machines/new');
  const newForm = await p.evaluate(() => {
    const inputs = [...document.querySelectorAll('input:not([type="hidden"]):not([type="password"]), textarea, select')];
    const labels = [...document.querySelectorAll('label')].map((l) => l.innerText.trim());
    return { count: inputs.length, labels };
  });
  if (newForm.count >= 5) ok(`Machines new page: form renders (${newForm.count} fields)`);
  else nok('Machines new page: form fields', String(newForm.count));
  await ss('02-machines-new-en.png');

  await go('/admin/maintenance/machine-categories');
  info = await p.evaluate(() => ({ dir: document.documentElement.dir || document.body.getAttribute('dir'), text: document.body.innerText, tr: document.querySelectorAll('table tbody tr').length, table: !!document.querySelector('table') }));
  if (info.dir === 'ltr') ok('Machine Categories EN: dir=ltr');
  else nok('Machine Categories EN: dir', info.dir || 'none');
  if (info.text.includes('Machine Categories')) ok('Machine Categories EN: header translated');
  else nok('Machine Categories EN: header', '');
  if (info.table) ok(`Machine Categories EN: grid rendered (${info.tr} rows)`);
  else nok('Machine Categories EN: grid', '');
  const catModal = await openCreateModal('Create');
  if (catModal) ok('Machine Categories: create modal opens');
  else nok('Machine Categories: create modal', '');
  const catFields = await p.evaluate(() => ({ labels: [...document.querySelectorAll('[role="dialog"] label, .modal label, [class*="modal"] label')].map((l) => l.innerText.trim()).filter(Boolean) }));
  if (catFields.labels.some((l) => l.toLowerCase().includes('name'))) ok('Machine Categories modal: name field present');
  else nok('Machine Categories modal: name field', JSON.stringify(catFields.labels));
  await ss('03-machine-categories-modal-en.png');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);

  await go('/admin/maintenance/machine-components');
  info = await p.evaluate(() => ({ dir: document.documentElement.dir || document.body.getAttribute('dir'), text: document.body.innerText, tr: document.querySelectorAll('table tbody tr').length, table: !!document.querySelector('table') }));
  if (info.dir === 'ltr') ok('Machine Components EN: dir=ltr');
  else nok('Machine Components EN: dir', info.dir || 'none');
  if (info.text.includes('Machine Components')) ok('Machine Components EN: header translated');
  else nok('Machine Components EN: header', '');
  if (info.table) ok(`Machine Components EN: grid rendered (${info.tr} rows)`);
  else nok('Machine Components EN: grid', '');
  const compModal = await openCreateModal('Create');
  if (compModal) ok('Machine Components: create modal opens');
  else nok('Machine Components: create modal', '');
  await clickSave();
  const compErrs = await countInlineErrors();
  if (compErrs.count >= 3) ok(`Machine Components modal: inline required errors (${compErrs.count})`);
  else nok('Machine Components modal: inline errors', String(compErrs.count));
  if (compErrs.focused) ok(`Machine Components modal: focus on first invalid field (${compErrs.focused})`);
  else nok('Machine Components modal: focus move', compErrs.focused || 'none');
  await ss('04-machine-components-modal-inline-errors-en.png');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);

  await go('/admin/maintenance/machine-parts');
  info = await p.evaluate(() => ({ dir: document.documentElement.dir || document.body.getAttribute('dir'), text: document.body.innerText, tr: document.querySelectorAll('table tbody tr').length, table: !!document.querySelector('table') }));
  if (info.dir === 'ltr') ok('Machine Parts EN: dir=ltr');
  else nok('Machine Parts EN: dir', info.dir || 'none');
  if (info.text.includes('Machine Parts')) ok('Machine Parts EN: header translated');
  else nok('Machine Parts EN: header', '');
  if (info.table) ok(`Machine Parts EN: grid rendered (${info.tr} rows)`);
  else nok('Machine Parts EN: grid', '');
  const partModal = await openCreateModal('Create');
  if (partModal) ok('Machine Parts: create modal opens');
  else nok('Machine Parts: create modal', '');
  await clickSave();
  const partErrs = await countInlineErrors();
  if (partErrs.count >= 2) ok(`Machine Parts modal: inline required errors (${partErrs.count})`);
  else nok('Machine Parts modal: inline errors', String(partErrs.count));
  await ss('05-machine-parts-modal-en.png');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);

  await go('/admin/maintenance/machine-documents');
  info = await p.evaluate(() => ({ dir: document.documentElement.dir || document.body.getAttribute('dir'), text: document.body.innerText, tr: document.querySelectorAll('table tbody tr').length, table: !!document.querySelector('table') }));
  if (info.dir === 'ltr') ok('Machine Documents EN: dir=ltr');
  else nok('Machine Documents EN: dir', info.dir || 'none');
  if (info.text.includes('Machine Documents')) ok('Machine Documents EN: header translated');
  else nok('Machine Documents EN: header', '');
  if (info.table) ok(`Machine Documents EN: grid rendered (${info.tr} rows)`);
  else nok('Machine Documents EN: grid', '');
  const docModal = await openCreateModal('Create');
  if (docModal) ok('Machine Documents: create modal opens');
  else nok('Machine Documents: create modal', '');
  await clickSave();
  const docErrs = await countInlineErrors();
  if (docErrs.count >= 3) ok(`Machine Documents modal: inline required errors (${docErrs.count})`);
  else nok('Machine Documents modal: inline errors', String(docErrs.count));
  await ss('06-machine-documents-modal-en.png');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);

  // ============ WEB: AR RTL ============
  console.log('\n[WEB AR RTL]');
  await setLocale('ar');

  await go('/admin/maintenance/machines');
  info = await p.evaluate(() => ({ dir: document.documentElement.dir || document.body.getAttribute('dir'), text: document.body.innerText, tr: document.querySelectorAll('table tbody tr').length }));
  if (info.dir === 'rtl') ok('Machines AR: dir=rtl');
  else nok('Machines AR: dir', info.dir || 'none');
  if (info.text.includes('الماكينات') || info.text.includes('آلات')) ok('Machines AR: header translated');
  else nok('Machines AR: header', '');
  await ss('07-machines-ar-rtl.png');

  await go('/admin/maintenance/machine-categories');
  info = await p.evaluate(() => ({ dir: document.documentElement.dir || document.body.getAttribute('dir'), text: document.body.innerText }));
  if (info.dir === 'rtl') ok('Machine Categories AR: dir=rtl');
  else nok('Machine Categories AR: dir', info.dir || 'none');
  if (info.text.includes('تصنيفات الماكينات') || info.text.includes('تصنيف')) ok('Machine Categories AR: header translated');
  else nok('Machine Categories AR: header', '');
  await ss('08-machine-categories-ar-rtl.png');

  await go('/admin/maintenance/machine-components');
  info = await p.evaluate(() => ({ dir: document.documentElement.dir || document.body.getAttribute('dir'), text: document.body.innerText }));
  if (info.dir === 'rtl') ok('Machine Components AR: dir=rtl');
  else nok('Machine Components AR: dir', info.dir || 'none');
  if (info.text.includes('مكونات الماكينة') || info.text.includes('مكونات الماكينات')) ok('Machine Components AR: header translated');
  else nok('Machine Components AR: header', '');
  await ss('09-machine-components-ar-rtl.png');

  await go('/admin/maintenance/machine-parts');
  info = await p.evaluate(() => ({ dir: document.documentElement.dir || document.body.getAttribute('dir'), text: document.body.innerText }));
  if (info.dir === 'rtl') ok('Machine Parts AR: dir=rtl');
  else nok('Machine Parts AR: dir', info.dir || 'none');
  if (info.text.includes('قطع الماكينات') || info.text.includes('قطع')) ok('Machine Parts AR: header translated');
  else nok('Machine Parts AR: header', '');
  await ss('10-machine-parts-ar-rtl.png');

  await go('/admin/maintenance/machine-documents');
  info = await p.evaluate(() => ({ dir: document.documentElement.dir || document.body.getAttribute('dir'), text: document.body.innerText }));
  if (info.dir === 'rtl') ok('Machine Documents AR: dir=rtl');
  else nok('Machine Documents AR: dir', info.dir || 'none');
  if (info.text.includes('مستندات الماكينات') || info.text.includes('مستند')) ok('Machine Documents AR: header translated');
  else nok('Machine Documents AR: header', '');
  await ss('11-machine-documents-ar-rtl.png');

  // ============ CONSOLE ============
  console.log('\n[CONSOLE]');
  const resourceErrs = cerr.filter((m) => m.startsWith('Failed to load resource'));
  const appErrs = cerr.filter((m) => !m.startsWith('Failed to load resource'));
  if (appErrs.length === 0) ok(`No application console errors (${resourceErrs.length} resource-load failures = deliberate 4xx contract probes)`);
  else nok(`${appErrs.length} application console errors`, appErrs.join(' | '));
  await ss('12-final.png');

} catch (e) {
  console.error(`\nFATAL: ${e.message}`);
  nok('Script', e.message);
} finally {
  // ============ FIXTURE CLEANUP ============
  console.log('\n[CLEANUP]');
  for (const f of FIXTURES.reverse()) {
    try {
      const endpoint = { category: '/maintenance/machine-categories', part: '/maintenance/machine-parts', component: '/maintenance/machine-components', document: '/maintenance/machine-documents', machine: '/maintenance/machines' }[f.type];
      const res = await apiCall('DELETE', `${endpoint}/${f.id}`, null, 'en');
      console.log(`  cleanup ${f.type} ${f.id}: ${res.status}`);
    } catch (e2) { console.log(`  cleanup ${f.type} ${f.id}: error ${e2.message}`); }
  }
  const leftover = await apiCall('GET', `/audit-logs?entity=Machine&limit=5&search=UX1B2A`, null, 'en');
  console.log(`  UX1B2A audit rows remaining (read-only check): ${Array.isArray(leftover.body?.data) ? leftover.body.data.length : '?'}`);
  await browser.close();
  const report = { timestamp: new Date().toISOString(), pass: R.pass, fail: R.fail, consoleErrors: cerr.length, result: R.fail === 0 ? 'PASS' : 'FAIL' };
  fs.writeFileSync(path.join(SS_DIR, 'ux1b2a-results.json'), JSON.stringify(report, null, 2));
  console.log(`\n=== UX1B2A PROOF: ${R.pass} PASS, ${R.fail} FAIL ===`);
  process.exit(R.fail > 0 ? 1 : 0);
}
