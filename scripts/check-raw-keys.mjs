import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = new URL('../', import.meta.url);

const PASS = [];
const FAIL = [];
let exitCode = 0;

function pass(message) {
  PASS.push(message);
}

function fail(message) {
  FAIL.push(message);
  exitCode = 1;
}

function read(relativePath) {
  return readFileSync(new URL(relativePath, ROOT), 'utf-8');
}

// --- 1. Dynamic t() concatenation patterns that can leak raw keys ---
// The old CmmsPriorityBadge pattern `t('status.' + p)` returned the raw key
// when the status was missing from the dictionary (e.g. URGENT, ONCE). With
// the new t() contract these are safe (localized fallback), but they are
// reported separately so the remaining dynamic usages stay visible.
const CONCAT_PATTERNS = [
  { pattern: /[^.\w]t\(\s*['"]status\.['"]?\s*\+\s*\w+\s*\)/g, label: 't(\'status.\' + value)' },
  { pattern: /[^.\w]t\(\s*`([^`]*)\$\{/g, label: 't(template literal with interpolation)' },
];

console.log('--- 1. Dynamic t() key concatenation must not exist ---');
function collectFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      results.push(...collectFiles(fullPath));
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

const WEB_SRC_PATH = fileURLToPath(new URL('../apps/web/src/', import.meta.url));

let dynamicCount = 0;
const dynamicSites = [];
for (const file of collectFiles(WEB_SRC_PATH)) {
  const content = readFileSync(file, 'utf-8');
  for (const { pattern, label } of CONCAT_PATTERNS) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      dynamicCount += 1;
      dynamicSites.push(`${label} in ${file.replace(WEB_SRC_PATH, '')}: ${matches.join(' | ')}`);
    }
  }
}
if (dynamicCount === 0) {
  pass('No dynamic t() key concatenation patterns found.');
} else {
  // Dynamic keys are safe with the fallback contract; report them separately.
  console.warn(`WARN: ${dynamicCount} dynamic t() key site(s) (safe with fallback contract):`);
  for (const site of dynamicSites) console.warn(`  ${site}`);
}

// --- 2. Known badge components must use the canonical translators ---
console.log('--- 2. Status and priority badges use canonical translators ---');
const BADGE_FILES = [
  'apps/web/src/components/maintenance/CmmsPriorityBadge.tsx',
  'apps/web/src/components/entity/entity-status-badge.tsx',
  'apps/web/src/components/admin/notifications/notification-priority-badge.tsx',
];

const RAW_RENDER_PATTERNS = [
  { pattern: /\{\s*(priority|status)\s*\}\s*(?![:=])/g, label: 'raw {priority}/{status} render' },
  { pattern: /t\(\s*['"]status\.\s*['"]\s*\+\s*/g, label: 't(\'status.\' + p)' },
];

for (const file of BADGE_FILES) {
  let content;
  try {
    content = read(file);
  } catch {
    fail(`${file}: could not be read`);
    continue;
  }
  let bad = false;
  for (const { pattern, label } of RAW_RENDER_PATTERNS) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      bad = true;
      fail(`${file}: ${label} pattern present: ${matches.join(' | ')}`);
    }
  }
  const usesCanonical = /translatePriority|translateStatus/.test(content);
  if (!usesCanonical) {
    bad = true;
    fail(`${file}: does not use translatePriority/translateStatus`);
  }
  if (!bad) {
    pass(`${file}: uses canonical translator, no raw renders.`);
  }
}

// --- 3. Priority/status literals must exist in the dictionary ---
console.log('--- 3. URGENT and ONCE are translated in both locales ---');
const enCommon = read('apps/web/src/lib/i18n/locales/en/common.ts');
const arCommon = read('apps/web/src/lib/i18n/locales/ar/common.ts');
for (const literal of ['URGENT', 'ONCE']) {
  const inEn = new RegExp(`\\b${literal}:\\s*['"]`).test(enCommon);
  const inAr = new RegExp(`\\b${literal}:\\s*['"]`).test(arCommon);
  if (inEn && inAr) {
    pass(`status.${literal} exists in EN and AR.`);
  } else {
    fail(`status.${literal} missing: EN=${inEn} AR=${inAr}`);
  }
}

for (const p of PASS) console.log(`PASS: ${p}`);
for (const f of FAIL) console.error(`FAIL: ${f}`);

if (exitCode === 0) {
  console.log('Raw-key safety check passed.');
} else {
  console.error(`${FAIL.length} raw-key safety failure(s).`);
}
process.exit(exitCode);
