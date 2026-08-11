import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

if (!process.env.SEED_ADMIN_EMAIL) {
  throw new Error('SEED_ADMIN_EMAIL environment variable is required');
}

if (!process.env.SEED_ADMIN_PASSWORD) {
  throw new Error('SEED_ADMIN_PASSWORD environment variable is required');
}

const ROOT = new URL('../../', import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WEB = 'http://localhost:3000';
const API = 'http://localhost:4000/api/v1';

const results = [];
const evidence = { ranAt: new Date().toISOString(), steps: [] };

function pass(name, detail = '') {
  results.push({ name, status: 'PASS', detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, status: 'FAIL', detail });
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const apiLocaleHeaders = [];
page.on('request', (req) => {
  if (req.url().startsWith(API)) {
    const h = req.headers()['x-locale'] ?? '(none)';
    apiLocaleHeaders.push(h);
  }
});

const apiFetch = async (path, options = {}) =>
  page.evaluate(
    async ({ apiBase, p, o }) => {
      const headers = { 'Content-Type': 'application/json', ...(o.headers ?? {}) };
      const token = localStorage.getItem('accessToken');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const currentUserId = localStorage.getItem('atsoft.erp.operational-context.current-user');
      const raw = currentUserId ? localStorage.getItem(`atsoft.erp.operational-context.user.${encodeURIComponent(currentUserId)}`) : null;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const ctx = parsed.context ?? parsed;
          if (ctx.companyId) headers['x-active-company-id'] = ctx.companyId;
          if (ctx.branchId) headers['x-active-branch-id'] = ctx.branchId;
        } catch { /* ignore */ }
      }
      const res = await fetch(`${apiBase}${p}`, { ...o, headers });
      let body = null;
      try { body = await res.json(); } catch { /* ignore */ }
      return { status: res.status, body };
    },
    { apiBase: API, p: path, o: options },
  );

const waitForContext = async () => {
  for (let i = 0; i < 20; i++) {
    const has = await page.evaluate(() => {
      const uid = localStorage.getItem('atsoft.erp.operational-context.current-user');
      return uid ? localStorage.getItem(`atsoft.erp.operational-context.user.${encodeURIComponent(uid)}`) !== null : false;
    });
    if (has) return true;
    await page.waitForTimeout(500);
  }
  return false;
};

try {
  // 1. Default locale: server cookie absent -> Arabic RTL
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  const htmlAttrs = await page.evaluate(() => {
    const el = document.documentElement;
    return { lang: el.getAttribute('lang'), dir: el.getAttribute('dir') };
  });
  if (htmlAttrs.dir === 'rtl' && htmlAttrs.lang === 'ar') {
    pass('default html lang=ar dir=rtl (server-side cookies())', JSON.stringify(htmlAttrs));
  } else {
    fail('default html lang/dir', JSON.stringify(htmlAttrs));
  }

  // 2. Locale cookie -> English LTR (x-locale header asserted after a real API call)
  await context.addCookies([{ name: 'atsoft_locale', value: 'en', domain: 'localhost', path: '/' }]);
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  const enAttrs = await page.evaluate(() => {
    const el = document.documentElement;
    return { lang: el.getAttribute('lang'), dir: el.getAttribute('dir') };
  });
  if (enAttrs.dir === 'ltr' && enAttrs.lang === 'en') {
    pass('cookie atsoft_locale=en -> html lang=en dir=ltr', JSON.stringify(enAttrs));
  } else {
    fail('en html lang/dir', JSON.stringify(enAttrs));
  }
  await page.click('form button[type="submit"]');
  await page.waitForSelector('#email-error', { timeout: 5000 });
  const loginAria = await page.evaluate(() => {
    const email = document.querySelector('input[name="email"]');
    const password = document.querySelector('input[name="password"]');
    return {
      emailInvalid: email?.getAttribute('aria-invalid'),
      emailDescribedBy: email?.getAttribute('aria-describedby'),
      passwordInvalid: password?.getAttribute('aria-invalid'),
      passwordDescribedBy: password?.getAttribute('aria-describedby'),
      emailError: document.querySelector('#email-error')?.textContent?.trim() ?? '',
      passwordError: document.querySelector('#password-error')?.textContent?.trim() ?? '',
    };
  });
  if (loginAria.emailInvalid === 'true' && loginAria.emailDescribedBy === 'email-error' &&
      loginAria.passwordInvalid === 'true' && loginAria.passwordDescribedBy === 'password-error' &&
      loginAria.emailError === 'This field is required.' && loginAria.passwordError === 'This field is required.') {
    pass('empty login -> inline errors + aria-invalid + aria-describedby (EN)', JSON.stringify(loginAria));
  } else {
    fail('empty login ARIA/errors', JSON.stringify(loginAria));
  }

  // 4. Wrong credentials -> global error dialog with requestId, focus restore, Escape close
  await page.fill('input[name="email"]', process.env.SEED_ADMIN_EMAIL);
  await page.fill('input[name="password"]', 'definitely-wrong-password');
  await page.click('form button[type="submit"]');
  await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 10000 });
  const dialogState = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const headingId = dialog?.getAttribute('aria-labelledby');
    const heading = headingId ? document.getElementById(headingId)?.textContent?.trim() : '';
    const alert = dialog?.querySelector('[role="alert"]')?.textContent?.trim() ?? '';
    const bodyText = dialog?.textContent ?? '';
    const rid = bodyText.match(/Request ID:\s*([0-9a-f-]{36})/i)?.[1] ?? '';
    return { heading, alert, rid, hasFocusTrapAttr: dialog?.getAttribute('aria-modal') === 'true' };
  });
  if (dialogState.heading === 'Error' && dialogState.alert.length > 0 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dialogState.rid)) {
    pass('login failure -> global error dialog (title=Error, role=alert, requestId)', JSON.stringify(dialogState));
  } else {
    fail('global error dialog state', JSON.stringify(dialogState));
  }
  const hasLocaleHeader = apiLocaleHeaders.includes('en');
  if (hasLocaleHeader) {
    pass('x-locale=en sent on API requests', JSON.stringify(apiLocaleHeaders));
  } else {
    fail('x-locale header', JSON.stringify(apiLocaleHeaders));
  }
  const focusInDialog = await page.evaluate(() => document.activeElement?.closest?.('[role="dialog"]') !== null);
  if (focusInDialog) pass('focus moved into dialog on open');
  else fail('focus into dialog', await page.evaluate(() => document.activeElement?.tagName ?? ''));
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"][aria-modal="true"]', { state: 'detached', timeout: 5000 });
  const focusRestored = await page.evaluate(() => {
    const active = document.activeElement;
    const submit = document.querySelector('form button[type="submit"]');
    return { activeTag: active?.tagName ?? '', restored: active === submit };
  });
  if (focusRestored.restored) {
    pass('Escape closes dialog and restores focus to trigger button', JSON.stringify(focusRestored));
  } else {
    fail('focus restore after close', JSON.stringify(focusRestored));
  }

  // 5. Successful login as seeded admin
  await page.fill('input[name="password"]', process.env.SEED_ADMIN_PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 }),
    page.click('form button[type="submit"]'),
  ]);
  pass('admin login succeeded', page.url());

  // Handle operational context gate if present
  const gateVisible = await page.locator('.operational-context-gate, [data-testid="context-gate"]').count();
  if (gateVisible > 0) {
    const proceed = page.locator('button', { hasText: /Proceed|Continue|متابعة/ }).first();
    if (await proceed.count()) {
      await proceed.click();
      await page.waitForTimeout(1500);
      pass('operational context gate dismissed');
    }
  }

  // 6. Companies page: create modal ARIA
  await page.goto(`${WEB}/admin/core/companies`, { waitUntil: 'networkidle' });
  await page.click('button.admin-action-btn[title="Create"]');
  await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 5000 });
  const modalAria = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const headingId = dialog?.getAttribute('aria-labelledby');
    const heading = headingId ? document.getElementById(headingId)?.textContent?.trim() ?? '' : '';
    return { heading, labelledBy: headingId };
  });
  if (modalAria.labelledBy && modalAria.heading === 'New Company') {
    pass('create company modal: role=dialog aria-modal aria-labelledby -> "New Company"', JSON.stringify(modalAria));
  } else {
    fail('create modal ARIA', JSON.stringify(modalAria));
  }

  // 7. Client validation path: empty submit -> inline field error + focus first invalid (dialog:false)
  await page.click('button:has-text("Save")');
  await page.waitForSelector('input[name="name"][aria-invalid="true"]', { timeout: 5000 });
  const inlineState = await page.evaluate(() => {
    const name = document.querySelector('input[name="name"]');
    return {
      nameInvalid: name?.getAttribute('aria-invalid'),
      nameDescribedBy: name?.getAttribute('aria-describedby'),
      activeName: document.activeElement?.getAttribute('name'),
      globalAlert: document.querySelector('[role="dialog"] [role="alert"]') !== null,
      errorText: name?.closest('div')?.textContent?.match(/This field is required\./)?.[0] ?? '',
    };
  });
  if (inlineState.nameInvalid === 'true' && inlineState.nameDescribedBy && inlineState.activeName === 'name' && !inlineState.globalAlert && inlineState.errorText === 'This field is required.') {
    pass('empty company submit -> inline error + focus on first invalid field, NO global dialog', JSON.stringify(inlineState));
  } else {
    fail('inline validation state', JSON.stringify(inlineState));
  }

  // 8. Backend validation contract (live): ValidationPipe -> transformer -> filter -> localized field errors + requestId
  const ctxReady = await waitForContext();
  if (ctxReady) pass('operational context resolved in browser storage');
  else fail('operational context resolution');
  const badCreate = await apiFetch('/companies', {
    method: 'POST',
    body: JSON.stringify({ name: 123 }),
    headers: { 'x-locale': 'en' },
  });
  const v = badCreate.body ?? {};
  if (badCreate.status === 400 && v.success === false && v.messageKey === 'common.validationFailed' &&
      Array.isArray(v.message) && v.message[0] === 'Validation failed' &&
      Array.isArray(v.errors) && v.errors[0]?.field === 'name' && v.errors[0]?.code === 'validation.invalidValue' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.requestId ?? '')) {
    pass('backend 400 validation contract (EN): messageKey+field errors+requestId, no raw exception leak', JSON.stringify({ status: badCreate.status, messageKey: v.messageKey, errors: v.errors, requestId: v.requestId }));
  } else {
    fail('backend validation contract (EN)', JSON.stringify({ status: badCreate.status, body: v }));
  }
  const badCreateAr = await apiFetch('/companies', {
    method: 'POST',
    body: JSON.stringify({ name: 123 }),
    headers: { 'x-locale': 'ar' },
  });
  const varBody = badCreateAr.body ?? {};
  const arMessageText = Array.isArray(varBody.message) ? varBody.message.join(' ') : '';
  if (badCreateAr.status === 400 && /[\u0600-\u06FF]{2,}/.test(arMessageText) && !/^[a-zA-Z0-9._]+$/.test(arMessageText)) {
    pass('backend validation message localized to Arabic via x-locale: ar', arMessageText);
  } else {
    fail('backend validation message (AR)', JSON.stringify({ status: badCreateAr.status, message: varBody.message }));
  }

  // 9. Arabic RTL runtime
  await context.addCookies([{ name: 'atsoft_locale', value: 'ar', domain: 'localhost', path: '/' }]);
  await page.goto(`${WEB}/admin/core/companies`, { waitUntil: 'networkidle' });
  const arState = await page.evaluate(() => {
    const el = document.documentElement;
    const bodyText = document.body.textContent ?? '';
    const hasArabic = /[\u0600-\u06FF]{2,}/.test(bodyText);
    return { lang: el.getAttribute('lang'), dir: el.getAttribute('dir'), hasArabic };
  });
  if (arState.lang === 'ar' && arState.dir === 'rtl' && arState.hasArabic) {
    pass('arabic runtime: lang=ar dir=rtl with Arabic text', JSON.stringify(arState));
  } else {
    fail('arabic runtime', JSON.stringify(arState));
  }

  // 10. Arabic error dialog (untranslated-key safety: message must be Arabic, never a raw key)
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', process.env.SEED_ADMIN_EMAIL);
  await page.fill('input[name="password"]', 'wrong-password-ar');
  await page.click('form button[type="submit"]');
  await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 10000 });
  const arDialog = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const headingId = dialog?.getAttribute('aria-labelledby');
    const heading = headingId ? document.getElementById(headingId)?.textContent?.trim() ?? '' : '';
    const alert = dialog?.querySelector('[role="alert"]')?.textContent?.trim() ?? '';
    const bodyText = dialog?.textContent ?? '';
    const rid = bodyText.match(/معرّ?ف الطلب:\s*([0-9a-f-]{36})/i)?.[1] ?? '';
    return { heading, alert, rid };
  });
  if (/[\u0600-\u06FF]{2,}/.test(arDialog.heading) && /[\u0600-\u06FF]{2,}/.test(arDialog.alert) && /^[0-9a-f-]{36}$/i.test(arDialog.rid) && !/^[a-zA-Z0-9._]+$/.test(arDialog.alert)) {
    pass('arabic error dialog: localized AR heading + message + requestId, no raw key', JSON.stringify(arDialog));
  } else {
    fail('arabic error dialog', JSON.stringify(arDialog));
  }
  await page.keyboard.press('Escape');

  evidence.steps.push({ labels: results });
} catch (err) {
  fail('script exception', err.message);
} finally {
  await browser.close();
}

const failed = results.filter((r) => r.status === 'FAIL');
evidence.total = results.length;
evidence.failed = failed.length;
evidence.passed = results.length - failed.length;
evidence.ok = failed.length === 0;

const evidenceDir = path.resolve(__dirname, '..', 'evidence');
mkdirSync(evidenceDir, { recursive: true });
const evidenceFile = path.join(evidenceDir, 'ux1a-runtime-proof.json');
writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
console.log(`\n=== RESULTS: ${evidence.passed}/${evidence.total} passed ===`);
console.log(`Evidence: ${evidenceFile}`);
process.exit(failed.length === 0 ? 0 : 1);
