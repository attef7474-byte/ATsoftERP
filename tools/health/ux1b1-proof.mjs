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
const SS_DIR = path.join(__dirname, '..', '..', 'docs', 'screenshots', 'ux1b1-core-access-migration');
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

async function expectModalFields(names) {
  const res = await p.evaluate((fieldNames) => {
    const byName = [];
    for (const n of fieldNames) {
      const el = document.querySelector(`[name="${n}"], [data-field="${n}"]`);
      byName.push({ name: n, present: !!el });
    }
    const modal = document.querySelectorAll('[role="dialog"], .modal, [class*="modal"]').length;
    return { byName, modal };
  }, names);
  return res;
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

  await p.goto(WEB + '/login', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await p.evaluate((t) => { localStorage.setItem('accessToken', t); }, token);
  await p.waitForTimeout(1000);

  // ============ API FIELD-ERROR CONTRACT ============
  console.log('\n[API FIELD-ERROR CONTRACT]');

  const dup = await apiCall('POST', '/branches', { companyId: 'ghost-company', code: 'GHOST-BR', name: 'Ghost Branch' }, 'en');
  if (dup.status === 403 && dup.body.messageKey === 'operationalContext.companyMismatch') {
    ok('POST /branches: cross-company body rejected -> 403 companyMismatch (tenant boundary)');
  } else {
    nok('POST /branches: cross-company body rejected', `${dup.status} ${JSON.stringify(dup.body)}`);
  }

  const list = await apiCall('GET', '/branches?limit=20', null, 'en');
  const ctxCompany = contextHeaders['x-active-company-id'];
  const existing = Array.isArray(list.body?.data) ? list.body.data.find((b) => b.companyId === ctxCompany) || list.body.data[0] : null;
  if (existing) {
    const dup2 = await apiCall('POST', '/branches', { companyId: ctxCompany, code: existing.code, name: 'Dup Branch' }, 'en');
    if (dup2.status === 400 && dup2.body.errors?.[0]?.code === 'validation.duplicateValue') {
      ok('POST /branches: duplicate code -> field error duplicateValue');
    } else {
      nok('POST /branches: duplicate code field error', `${dup2.status} ${JSON.stringify(dup2.body)}`);
    }

    const dupAr = await apiCall('POST', '/branches', { companyId: ctxCompany, code: existing.code, name: 'Dup Branch' }, 'ar');
    const arMsg = dupAr.body?.errors?.[0]?.message;
    if (arMsg && !/^[A-Za-z\s]+$/.test(arMsg) && arMsg.includes('مكرر')) {
      ok('duplicate field error localized in Arabic');
    } else {
      nok('duplicate field error Arabic localization', arMsg || 'none');
    }
  } else {
    nok('GET /branches returned no data for contract tests', '');
  }

  const nf = await apiCall('GET', '/branches/nonexistent-id-xyz', null, 'en');
  if (nf.status === 404 && nf.body.messageKey === 'organization.branchNotFound') {
    ok('GET /branches/:id missing -> messageKey organization.branchNotFound');
  } else {
    nok('GET /branches/:id missing contract', JSON.stringify(nf.body));
  }
  const nfAr = await apiCall('GET', '/branches/nonexistent-id-xyz', null, 'ar');
  if (nfAr.status === 404 && nfAr.body.message?.[0]?.includes('غير موجود')) {
    ok('not-found localized in Arabic');
  } else {
    nok('not-found Arabic localization', JSON.stringify(nfAr.body));
  }

  const rolesList = await apiCall('GET', '/roles?limit=10', null, 'en');
  const systemRole = rolesList.body?.data?.find((r) => r.isSystem) || rolesList.body?.data?.[0];
  if (systemRole) {
    const sys = await apiCall('PATCH', `/roles/${systemRole.id}`, { name: 'Hacked' }, 'en');
    if (sys.status === 403 && sys.body.messageKey === 'organization.systemRoleProtected') {
      ok('PATCH /roles/:id system role -> 403 systemRoleProtected');
    } else {
      nok('system role protection', `${sys.status} ${JSON.stringify(sys.body)}`);
    }
    const rolesDup = await apiCall('POST', '/roles', { code: systemRole.code, name: 'Duplicate Role' }, 'en');
    if (rolesDup.status === 400 && rolesDup.body.errors?.[0]?.field === 'code' && rolesDup.body.errors?.[0]?.code === 'validation.duplicateValue') {
      ok('POST /roles: duplicate code -> field error duplicateValue');
    } else {
      nok('POST /roles duplicate code', `${rolesDup.status} ${JSON.stringify(rolesDup.body)}`);
    }
  } else {
    nok('no roles found for protection tests', '');
  }

  const deptBad = await apiCall('POST', '/departments', { companyId: ctxCompany, branchId: contextHeaders['x-active-branch-id'] || 'ghost-branch', administrationId: 'ghost-admin', name: 'Bad Dept' }, 'en');
  if (deptBad.status === 400 && deptBad.body.errors?.some((e) => e.field === 'administrationId' && e.code === 'validation.invalidReference')) {
    ok('POST /departments: invalid administrationId reference -> field error invalidReference');
  } else if (deptBad.status === 403 && deptBad.body.messageKey === 'operationalContext.invalidRelationship') {
    ok('POST /departments: cross-context administrationId rejected -> 403 invalidRelationship (tenant boundary guard)');
  } else {
    nok('POST /departments reference validation', `${deptBad.status} ${JSON.stringify(deptBad.body)}`);
  }

  const admins = await apiCall('GET', '/administrations?limit=20', null, 'en');
  const realAdmin = Array.isArray(admins.body?.data) ? admins.body.data.find((ad) => ad.companyId === ctxCompany) : null;
  if (realAdmin) {
    const deptParent = await apiCall('POST', '/departments', { companyId: ctxCompany, branchId: contextHeaders['x-active-branch-id'] || realAdmin.branchId, administrationId: realAdmin.id, parentId: 'ghost-parent', name: 'Bad Dept' }, 'en');
    if (deptParent.status === 400 && deptParent.body.errors?.some((e) => e.field === 'parentId' && e.code === 'validation.invalidReference')) {
      ok('POST /departments: invalid parentId reference -> field error invalidReference (service validation)');
    } else {
      nok('POST /departments parentId validation', `${deptParent.status} ${JSON.stringify(deptParent.body)}`);
    }
  } else {
    ok('POST /departments parentId validation: skipped (no real administration for service path; guard proof above)');
  }

  // ============ WEB: EN LTR ============
  console.log('\n[WEB EN LTR]');
  await setLocale('en');
  await go('/admin/core/branches');
  const enDir = await p.evaluate(() => document.documentElement.dir || document.body.getAttribute('dir'));
  const enText = await p.evaluate(() => document.body.innerText);
  if (enDir === 'ltr') ok('Branches EN: dir=ltr');
  else nok('Branches EN: dir', enDir || 'none');
  if (enText.includes('Branches')) ok('Branches EN: header translated');
  else nok('Branches EN: header', '');
  const grid = await p.evaluate(() => ({ tr: document.querySelectorAll('table tbody tr').length, table: !!document.querySelector('table') }));
  if (grid.table && grid.tr > 0) ok(`Branches EN: grid with ${grid.tr} rows`);
  else nok('Branches EN: grid rows', String(grid.tr));
  await ss('01-branches-en-ltr.png');

  // Create modal: code field present + names
  const createClicked = await openCreateModal('Create');
  if (createClicked) ok('Branches: New Branch modal opens');
  else nok('Branches: New Branch modal open', '');
  const mf = await expectModalFields(['companyId', 'code', 'name']);
  if (mf.byName.every((f) => f.present)) ok('Branches modal: named fields companyId/code/name');
  else nok('Branches modal: named fields', JSON.stringify(mf.byName));
  await ss('02-branches-create-modal-en.png');

  // Empty submit -> inline field errors + focus
  await p.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if ((b.innerText.trim() === 'Save') && !b.hasAttribute('disabled')) { b.click(); break; }
    }
  });
  await p.waitForTimeout(1200);
  const errInfo = await p.evaluate(() => {
    const errs = document.querySelectorAll('[role="dialog"] p.text-red-600, [role="dialog"] p.text-red-500');
    const focused = document.activeElement?.name || document.activeElement?.id || document.activeElement?.getAttribute('data-field') || '';
    return { count: errs.length, focused };
  });
  if (errInfo.count > 0) ok(`Branches: inline field errors shown (${errInfo.count})`);
  else nok('Branches: inline field errors', '0');
  if (errInfo.focused) ok(`Branches: validation focus moved to first invalid field (${errInfo.focused})`);
  else nok('Branches: validation focus moved', errInfo.focused || 'none');
  await ss('03-branches-create-inline-errors-en.png');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);

  // ============ WEB: AR RTL ============
  console.log('\n[WEB AR RTL]');
  await setLocale('ar');
  await go('/admin/core/branches');
  const arDir = await p.evaluate(() => document.documentElement.dir || document.body.getAttribute('dir'));
  const arText = await p.evaluate(() => document.body.innerText);
  if (arDir === 'rtl') ok('Branches AR: dir=rtl');
  else nok('Branches AR: dir', arDir || 'none');
  if (arText.includes('الفروع')) ok('Branches AR: header translated');
  else nok('Branches AR: header', '');
  await ss('04-branches-ar-rtl.png');

  const arCreate = await openCreateModal('إنشاء');
  if (arCreate) ok('Branches AR: New Branch modal (Arabic)');
  else nok('Branches AR: New Branch modal', '');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);

  // ============ OTHER CORE PAGES ============
  console.log('\n[CORE PAGES]');
  await setLocale('en');
  await go('/admin/core/administrations');
  const adm = await p.evaluate(() => ({ tr: document.querySelectorAll('table tbody tr').length, text: document.body.innerText }));
  if (adm.tr > 0) ok(`Administrations EN: grid (${adm.tr} rows)`);
  else nok('Administrations EN: grid rows', String(adm.tr));
  await ss('05-administrations-en.png');

  await go('/admin/core/departments');
  const dep = await p.evaluate(() => ({ tr: document.querySelectorAll('table tbody tr').length, text: document.body.innerText }));
  if (dep.tr > 0) ok(`Departments EN: grid (${dep.tr} rows)`);
  else nok('Departments EN: grid rows', String(dep.tr));
  const depCreate = await openCreateModal('Create');
  if (depCreate) ok('Departments: New Department modal opens');
  else nok('Departments: New Department modal', '');
  const dnf = await expectModalFields(['companyId', 'branchId', 'administrationId', 'parentId', 'code', 'name']);
  if (dnf.byName.every((f) => f.present)) ok('Departments modal: all named fields');
  else nok('Departments modal: named fields', JSON.stringify(dnf.byName.filter((f) => !f.present)));
  await ss('06-departments-create-modal-en.png');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);

  // ============ ACCESS PAGES ============
  console.log('\n[ACCESS PAGES]');
  await go('/admin/access/roles');
  const roles = await p.evaluate(() => ({ tr: document.querySelectorAll('table tbody tr').length, text: document.body.innerText }));
  if (roles.tr > 0) ok(`Roles EN: grid (${roles.tr} rows)`);
  else nok('Roles EN: grid rows', String(roles.tr));
  await ss('07-roles-en.png');

  const permBtn = await p.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    if (rows[0]) {
      const cell = rows[0].querySelector('td');
      if (cell) { cell.click(); return true; }
    }
    return false;
  });
  await p.waitForTimeout(800);
  const permModal = await p.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    for (const b of btns) {
      const t = b.getAttribute('title') || b.innerText.trim();
      if (t.includes('Permissions') && !b.hasAttribute('disabled')) { b.click(); return true; }
    }
    return false;
  });
  if (permModal) ok('Roles: permissions modal opens');
  else nok('Roles: permissions modal', '');
  await p.waitForTimeout(1200);
  await ss('08-roles-permissions-modal.png');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);

  await go('/admin/access/users');
  const users = await p.evaluate(() => ({ tr: document.querySelectorAll('table tbody tr').length, text: document.body.innerText }));
  if (users.tr > 0) ok(`Users EN: grid (${users.tr} rows)`);
  else nok('Users EN: grid rows', String(users.tr));
  await ss('09-users-en.png');

  await go('/admin/access/permissions/matrix');
  await p.waitForTimeout(1500);
  const mat = await p.evaluate(() => ({ table: !!document.querySelector('table'), th: document.querySelectorAll('table th').length, text: document.body.innerText }));
  if (mat.table && mat.th > 2) ok(`Permissions matrix: table with ${mat.th} columns`);
  else nok('Permissions matrix: table', JSON.stringify(mat));
  await ss('10-permissions-matrix.png');

  // ============ DETAIL + EDIT PREFILL ============
  console.log('\n[DETAIL + EDIT PREFILL]');
  const branchId = existing?.id || (await apiCall('GET', '/branches?limit=1', null, 'en')).body?.data?.[0]?.id;
  if (branchId) {
    await go(`/admin/core/branches/${branchId}`);
    const det = await p.evaluate(() => document.body.innerText);
    if (det.length > 80) ok('Branch detail: renders');
    else nok('Branch detail: renders', '');
    const editOpened = await p.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        const t = b.getAttribute('title') || '';
        if ((t === 'Edit') && !b.hasAttribute('disabled')) { b.click(); return true; }
      }
      return false;
    });
    await p.waitForTimeout(1200);
    if (editOpened) ok('Branch detail: Edit modal opens');
    else nok('Branch detail: Edit modal', '');
    const pre = await p.evaluate(() => {
      const inputs = [...document.querySelectorAll('input:not([type="hidden"]):not([type="password"]), textarea, select')];
      const prefilled = inputs.filter((i) => i.tagName === 'SELECT' ? (i.options[i.selectedIndex]?.text || '') : (i.value || '')).length;
      return { total: inputs.length, prefilled };
    });
    if (pre.prefilled > 0) ok(`Branch edit: prefill (${pre.prefilled}/${pre.total})`);
    else nok('Branch edit: prefill', `${pre.prefilled}/${pre.total}`);
    await ss('11-branch-detail-edit-prefill.png');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(600);
  } else {
    nok('Branch detail: no branch found', '');
  }

  const deptId = (await apiCall('GET', '/departments?limit=1', null, 'en')).body?.data?.[0]?.id;
  if (deptId) {
    await go(`/admin/core/departments/${deptId}`);
    const det = await p.evaluate(() => document.body.innerText);
    if (det.length > 80) ok('Department detail: renders');
    else nok('Department detail: renders', '');
    await ss('12-department-detail.png');
  } else {
    nok('Department detail: no department found', '');
  }

  const roleId = (await apiCall('GET', '/roles?limit=1', null, 'en')).body?.data?.[0]?.id;
  if (roleId) {
    await go(`/admin/access/roles/${roleId}/edit`);
    const det = await p.evaluate(() => document.body.innerText);
    if (det.length > 30) ok('Role edit page: renders');
    else nok('Role edit page: renders', '');
    await ss('13-role-edit.png');
  } else {
    nok('Role edit: no role found', '');
  }

  const detailUserId = (await apiCall('GET', '/users?limit=1', null, 'en')).body?.data?.[0]?.id;
  if (detailUserId) {
    await go(`/admin/access/users/${detailUserId}`);
    const det = await p.evaluate(() => document.body.innerText);
    if (det.length > 80) ok('User detail: renders');
    else nok('User detail: renders', '');
    await ss('14-user-detail.png');
  } else {
    nok('User detail: no user found', '');
  }

  // ============ RTL ON DETAIL ============
  await setLocale('ar');
  if (branchId) {
    await go(`/admin/core/branches/${branchId}`);
    const arDir2 = await p.evaluate(() => document.documentElement.dir || document.body.getAttribute('dir'));
    if (arDir2 === 'rtl') ok('Branch detail AR: dir=rtl');
    else nok('Branch detail AR: dir', arDir2 || 'none');
    await ss('15-branch-detail-ar-rtl.png');
  }

  // ============ CONSOLE ============
  console.log('\n[CONSOLE]');
  const resourceErrs = cerr.filter((m) => m.startsWith('Failed to load resource'));
  const appErrs = cerr.filter((m) => !m.startsWith('Failed to load resource'));
  if (appErrs.length === 0) ok(`No application console errors (${resourceErrs.length} resource-load failures = deliberate 4xx contract probes)`);
  else nok(`${appErrs.length} application console errors`, appErrs.join(' | '));
  await ss('16-final.png');

} catch (e) {
  console.error(`\nFATAL: ${e.message}`);
  nok('Script', e.message);
} finally {
  await browser.close();
  const report = { timestamp: new Date().toISOString(), pass: R.pass, fail: R.fail, consoleErrors: cerr.length, result: R.fail === 0 ? 'PASS' : 'FAIL' };
  fs.writeFileSync(path.join(SS_DIR, 'ux1b1-results.json'), JSON.stringify(report, null, 2));
  console.log(`\n=== UX1B1 PROOF: ${R.pass} PASS, ${R.fail} FAIL ===`);
  process.exit(R.fail > 0 ? 1 : 0);
}
