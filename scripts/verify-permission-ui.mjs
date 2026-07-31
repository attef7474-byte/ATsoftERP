import { readFileSync, readdirSync } from 'fs';
import path from 'path';

const ROOT = new URL('../', import.meta.url);

const RAW_KEYS = [
  'installed-parts:read',
  'maintenance-request:activity.view',
  'maintenance-request:attachments.view',
  'maintenance-request:print',
  'maintenance-request:activity',
  'maintenance-request:attachments',
  'maintenance-request:printData',
];

const AFFECTED_FILES = [
  'apps/web/src/app/admin/installed-parts/page.tsx',
  'apps/web/src/app/admin/maintenance/requests/[id]/activity/page.tsx',
  'apps/web/src/app/admin/maintenance/requests/[id]/attachments/page.tsx',
  'apps/web/src/app/admin/maintenance/requests/[id]/print/page.tsx',
  'apps/web/src/components/admin/maintenance/installed-parts-card.tsx',
  'apps/web/src/components/admin/maintenance/replacement-history-card.tsx',
];

const HARDCODED_DENIAL_PHRASES = [
  'do not have permission',
  'not have permission',
  'permission denied',
  'Permission Denied',
  'not authorized',
  'not permitted',
];

let failures = 0;

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function read(relativePath) {
  return readFileSync(new URL(relativePath, ROOT), 'utf-8');
}

console.log('--- 1. Raw permission keys must not appear in affected pages ---');
for (const file of AFFECTED_FILES) {
  const content = read(file);
  const found = RAW_KEYS.filter((key) => content.includes(key));
  if (found.length === 0) {
    pass(`${file}: no raw permission keys`);
  } else {
    fail(`${file}: contains raw keys ${found.join(', ')}`);
  }
}

console.log('--- 2. No hardcoded denial text in the web app ---');
const webFiles = [];
function walk(dir) {
  for (const entry of readdirSync(new URL(dir, ROOT), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'locales') continue;
    const full = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) webFiles.push(full);
  }
}
walk('apps/web/src');
let hardcoded = 0;
for (const file of webFiles) {
  const content = read(file);
  for (const phrase of HARDCODED_DENIAL_PHRASES) {
    if (content.includes(phrase)) {
      hardcoded += 1;
      fail(`${file}: hardcoded denial text "${phrase}"`);
    }
  }
}
if (hardcoded === 0) pass('no hardcoded permission-denial text anywhere in apps/web/src');

console.log('--- 3. EN/AR locale parity for permission-denial and error dialog keys ---');
for (const locale of ['en', 'ar']) {
  const common = read(`apps/web/src/lib/i18n/locales/${locale}/common.ts`);
  if (!common.includes('permissionDenied')) {
    fail(`${locale}/common.ts: errors.permissionDenied missing`);
  }
  if (!common.includes('insufficientPermissions')) {
    fail(`${locale}/common.ts: auth.insufficientPermissions missing (backend guard messageKey)`);
  }
}
const enCommon = read('apps/web/src/lib/i18n/locales/en/common.ts');
const arCommon = read('apps/web/src/lib/i18n/locales/ar/common.ts');
const enPermDenied = enCommon.match(/permissionDenied:\s*'([^']+)'/)?.[1];
const arPermDenied = arCommon.match(/permissionDenied:\s*'([^']+)'/)?.[1];
if (enPermDenied) pass(`en errors.permissionDenied: "${enPermDenied}"`);
else fail('en errors.permissionDenied value not found');
if (arPermDenied) pass(`ar errors.permissionDenied: "${arPermDenied}"`);
else fail('ar errors.permissionDenied value not found');
if (enPermDenied && arPermDenied) pass('both locales define errors.permissionDenied');
const enErrorDialog = read('apps/web/src/lib/i18n/locales/en/error-dialog.ts');
const arErrorDialog = read('apps/web/src/lib/i18n/locales/ar/error-dialog.ts');
const extractKeys = (content) => [...content.matchAll(/^\s{4}(\w+):\s*'/gm)].map((m) => m[1]).sort();
const enEdKeys = extractKeys(enErrorDialog);
const arEdKeys = extractKeys(arErrorDialog);
if (JSON.stringify(enEdKeys) === JSON.stringify(arEdKeys)) {
  pass(`error-dialog keys in parity (${enEdKeys.length} keys)`);
} else {
  fail(`error-dialog key mismatch: en=[${enEdKeys}] ar=[${arEdKeys}]`);
}

console.log('--- 4. Shared error dialog structure ---');
const errorModal = read('apps/web/src/components/admin/error-modal.tsx');
if (errorModal.includes("t('common.close')")) pass('error-modal close button is localized');
else fail('error-modal close button not localized');
if (errorModal.includes("t('errors.generalError')")) pass('error-modal title fallback is localized');
else fail('error-modal title fallback not localized');
if (errorModal.includes("Modal open={!!config}")) pass('error-modal uses the shared Modal component');
else fail('error-modal does not use the shared Modal component');
const errorUtils = read('apps/web/src/lib/error-utils.ts');
if (errorUtils.includes('messageKey') && errorUtils.includes('normalizeApiError')) {
  pass('normalizeApiError maps messageKey to a localized message');
} else {
  fail('normalizeApiError messageKey handling missing');
}

console.log('--- 5. Affected pages show translated loading/error/empty states ---');
for (const file of AFFECTED_FILES) {
  const content = read(file);
  const hasStates = content.includes('LoadingState') || content.includes('loading');
  const hasTranslatedError = content.includes("t('errors") || content.includes("t(\"errors") || content.includes('ErrorState');
  const isPrintPage = file.includes('/print/page.tsx');
  const hasEmpty = content.includes('emptyMessage') || content.includes('EmptyState') || content.includes('common.noData') || (isPrintPage && content.includes('details.notFound'));
  if (hasStates && hasTranslatedError && hasEmpty) {
    pass(`${file}: loading/error/empty states present`);
  } else {
    fail(`${file}: missing state handling (loading=${hasStates} error=${hasTranslatedError} empty=${hasEmpty})`);
  }
}

if (failures > 0) {
  console.error(`\nUI VERIFICATION FAILED: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nUI VERIFICATION PASSED: all checks succeeded.');
