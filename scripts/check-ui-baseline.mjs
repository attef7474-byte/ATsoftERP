#!/usr/bin/env node
/**
 * ATsoftERP — Official UI / Appearance / i18n / Access baseline integrity check.
 *
 * Reads the machine-readable accepted baseline manifest
 * (docs/governance/accepted-ui-i18n-baseline.json) and verifies every declared
 * invariant against the working tree:
 *   1. Protected files exist and are non-empty.
 *   2. Required exports / patterns per protected file.
 *   3. Required ATS design tokens in globals.css.
 *   4. Required routes are present in the web source tree.
 *   5. No visible raw permission keys in user-facing access pages.
 *   6. i18n locale namespaces present in en and ar.
 *   7. No mojibake (U+FFFD replacement characters) in protected text files.
 *   8. Appearance studio page integrity (data-theme-preview + PRESET_PROFILES).
 *
 * The manifest and this script define correctness against origin/main. The stale
 * legacy local checkout (Trae/ATsofterp at e78b0e7) is NOT the baseline.
 *
 * Usage: node scripts/check-ui-baseline.mjs
 * Exit code 0 on pass, 1 on failure. Run as part of qa:all.
 */

import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MANIFEST_PATH = 'docs/governance/accepted-ui-i18n-baseline.json';

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
  try {
    return readFileSync(join(ROOT, relativePath), 'utf-8');
  } catch {
    return '';
  }
}

function hasNonZeroSize(relativePath) {
  try {
    return statSync(join(ROOT, relativePath)).size > 0;
  } catch {
    return false;
  }
}

// --- 0. Manifest must exist and parse ---
console.log('--- 0. Accepted baseline manifest ---');
let manifest;
try {
  manifest = JSON.parse(read(MANIFEST_PATH));
  pass(`${MANIFEST_PATH} exists and is valid JSON.`);
} catch {
  fail(`${MANIFEST_PATH} is MISSING or INVALID JSON (manifest is required).`);
  manifest = null;
}

const protectedFiles = manifest?.protectedFiles || {};
const locales = manifest?.i18nLocaleNamespaces || {};
const forbiddenPatterns = manifest?.forbiddenVisiblePatterns || ['perm.key', 'permission.key', 'p.key'];

if (manifest) {
  const commits = manifest.acceptedMinimumCommits || [];
  for (const c of commits) {
    if (c.required && /^[0-9a-f]{40}$/.test(c.sha || '')) {
      pass(`accepted commit recorded: ${c.sha} (${c.subject}).`);
    } else {
      fail(`accepted commit ${c.sha || '<missing>'} is not a valid full SHA.`);
    }
  }
}

// --- 1. Protected files must exist and be non-empty ---
console.log('--- 1. Protected files are non-empty ---');
for (const [file, spec] of Object.entries(protectedFiles)) {
  if (!spec.nonEmpty) continue;
  if (hasNonZeroSize(file)) {
    pass(`${file} exists and is non-empty.`);
  } else {
    fail(`${file} is MISSING or EMPTY (corruption class).`);
  }
}

// --- 2. Required exports and patterns per protected file ---
console.log('--- 2. Required exports and patterns ---');
for (const [file, spec] of Object.entries(protectedFiles)) {
  const src = read(file);
  if (src === '') {
    if (!hasNonZeroSize(file)) continue;
    fail(`${file} could not be read (missing/empty).`);
    continue;
  }
  for (const exportName of spec.requiredExports || []) {
    if (new RegExp(`export (const|function|interface|type)\\s+${exportName}\\b|\\b${exportName},`).test(src)) {
      pass(`${file} exports ${exportName}.`);
    } else {
      fail(`${file} is missing required export ${exportName}.`);
    }
  }
  for (const pattern of spec.requiredPatterns || []) {
    if (src.includes(pattern)) {
      pass(`${file} contains ${pattern}.`);
    } else {
      fail(`${file} is missing required pattern ${pattern}.`);
    }
  }
}

// --- 3. Required tokens in globals.css ---
console.log('--- 3. ATS design tokens present in globals.css ---');
const cssFile = 'apps/web/src/app/globals.css';
const cssSrc = read(cssFile);
const cssSpec = protectedFiles[cssFile] || {};
for (const token of cssSpec.requiredTokens || []) {
  if (cssSrc.includes(token)) {
    pass(`globals.css defines ${token}.`);
  } else {
    fail(`globals.css is missing token ${token}.`);
  }
}

// --- 4. Required routes present in web source ---
console.log('--- 4. Required frontend routes ---');
const webSrc = join(ROOT, 'apps', 'web', 'src');
for (const route of manifest?.requiredRoutes || []) {
  const segments = route.split('/').filter(Boolean);
  const routeDir = join(webSrc, 'app', ...segments.map((s) => (s.startsWith('[') && s.endsWith(']') ? s : s)));
  const hasDir = (() => {
    try {
      return statSync(routeDir).isDirectory();
    } catch {
      return false;
    }
  })();
  if (hasDir) {
    pass(`route ${route} exists.`);
  } else {
    fail(`route ${route} is MISSING from apps/web/src/app.`);
  }
}

// --- 5. No visible raw permission keys in access pages ---
console.log('--- 5. No visible raw permission keys ---');
const RAW_KEY_RENDER_RE = /\{[^{}]*\.(?:permission|perm)\.key\s*\}/;
const ACCESS_PAGES = Object.keys(protectedFiles).filter((f) => f.includes('/admin/access/') && f.endsWith('.tsx'));
for (const file of ACCESS_PAGES) {
  const src = read(file);
  if (src === '') continue;
  const hits = [];
  for (const pat of forbiddenPatterns) {
    if (RAW_KEY_RENDER_RE.test(src) && src.includes(pat)) {
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (RAW_KEY_RENDER_RE.test(line) && line.includes(pat)) hits.push(`${i + 1}: ${line.trim()}`);
      });
    }
  }
  if (hits.length === 0) {
    pass(`${file} has no visible raw permission key rendering.`);
  } else {
    fail(`${file} renders raw permission keys:\n${hits.map((h) => `    ${h}`).join('\n')}`);
  }
}

// --- 6. i18n locale namespaces are non-empty ---
console.log('--- 6. i18n locale namespaces are non-empty ---');
for (const ns of locales.namespaces || []) {
  const enPath = `${locales.enDir}/${ns}`;
  const arPath = `${locales.arDir}/${ns}`;
  const enOk = hasNonZeroSize(enPath);
  const arOk = hasNonZeroSize(arPath);
  if (enOk && arOk) {
    pass(`i18n namespace ${ns} present in en and ar.`);
  } else {
    fail(`i18n namespace ${ns} missing/empty (en=${enOk} ar=${arOk}).`);
  }
}

// --- 7. No mojibake (U+FFFD) in protected text files ---
console.log('--- 7. Mojibake check on protected files ---');
const MOJIBAKE_FILES = [
  'apps/web/src/lib/i18n/literals.ts',
  'apps/web/src/app/globals.css',
  ...Object.keys(protectedFiles).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx')),
  'apps/web/src/lib/i18n/locales/en/access.ts',
  'apps/web/src/lib/i18n/locales/ar/access.ts',
];
for (const file of new Set(MOJIBAKE_FILES)) {
  const src = read(file);
  if (src === '') continue;
  const replacements = (src.match(/\uFFFD/g) || []).length;
  if (replacements === 0) {
    pass(`${file} has no mojibake (U+FFFD).`);
  } else {
    fail(`${file} contains ${replacements} mojibake replacement character(s) (U+FFFD).`);
  }
}

// --- 8. Appearance studio page integrity ---
console.log('--- 8. Appearance studio page integrity ---');
const appearancePageSrc = read('apps/web/src/app/admin/settings/appearance/page.tsx');
if (appearancePageSrc === '') {
  fail('appearance page.tsx could not be read (missing/empty).');
}
if (/data-theme-preview/.test(appearancePageSrc)) {
  pass('appearance page renders the live preview container.');
} else {
  fail('appearance page is missing data-theme-preview.');
}
if (/PRESET_PROFILES/.test(appearancePageSrc)) {
  pass('appearance page consumes PRESET_PROFILES.');
} else {
  fail('appearance page does not consume PRESET_PROFILES.');
}

for (const p of PASS) console.log(`PASS: ${p}`);
for (const f of FAIL) console.error(`FAIL: ${f}`);

if (exitCode === 0) {
  console.log(`UI baseline check passed. ${PASS.length} checks verified.`);
} else {
  console.error(`UI BASELINE CHECK FAILED: ${FAIL.length} failure(s).`);
}
process.exit(exitCode);
