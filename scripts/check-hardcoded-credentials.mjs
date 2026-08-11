#!/usr/bin/env node
/**
 * check-hardcoded-credentials.mjs
 *
 * TEXT TRACKED SOURCE credential gate. Every tracked text file is scanned.
 * Binary files are skipped by design: this is a text-source gate and does not
 * perform binary artifact scanning.
 *
 * Checks:
 *   1. Previously exposed credentials by SHA-256 fingerprint match in ANY
 *      tracked text file (code, fixtures, Markdown, and .env.example).
 *   2. Secret-named env reads with a literal fallback in code, e.g.
 *      a process.env read of a secret-named variable followed by a fallback
 *      literal.
 *   3. Obvious hardcoded secret assignments in executable code. A narrow
 *      allowlist skips unit-test fixtures, mock directories, i18n locale
 *      placeholders, and generated type declarations for THIS generic rule
 *      only. Checks 1 and 2 always scan those locations too.
 *
 * Previously exposed credentials are stored ONLY as non-reversible SHA-256
 * fingerprints. Their plaintext is never present in this source, in comments,
 * or in log output. Diagnostics print file paths, env/assignment variable
 * names, finding classes, and fingerprint identifiers only.
 *
 * Run: node scripts/check-hardcoded-credentials.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { isAbsolute } from 'node:path';

// SHA-256 fingerprints of previously exposed real credentials. The plaintext
// values are intentionally not stored in this file or its documentation.
const KNOWN_LEAKED_SHA256 = new Map([
  ['ad89b64d66caa8e30e5d5ce4a9763f4ecc205814c412175f3e2c50027471426d', 'KNOWN_LEAK_1'],
  ['5842511de291b041b58d78e50e2c900aa5c02feb7b265e0a4192c45c86221bb0', 'KNOWN_LEAK_2'],
  ['9d1023a5fc1c1f762f7c818e808cf0dd7b421e3f737fd26d995c3747a82799b6', 'KNOWN_LEAK_3'],
]);

const SECRET_ENV_FALLBACK =
  /process\.env\.([A-Z0-9_]*(?:PASSWORD|PASS|SECRET|TOKEN|API_KEY|API_SECRET|APISECRET|CREDENTIAL|CONNECTION_STRING)[A-Z0-9_]*|DATABASE_URL)\s*\|\|\s*["']([^"']{1,})["']/gi;

const SECRET_ASSIGNMENT =
  /(?<var>(?<!["'\w])(?:[A-Za-z0-9_]*_)?(?:password|pass|pwd|secret|apikey|api_key|api_secret|access_token|connection_string|connectionstring|jwt_secret))\s*[:=]\s*["'](?=[^"']*[0-9!@#$%^&*])[^"']{6,}["']/gi;

// Secret-bearing env var names for the .env-file rule.
const SECRET_ENV_NAME =
  /(?:PASSWORD|PASS|SECRET|TOKEN|API_KEY|API_SECRET|APISECRET|CREDENTIAL|CONNECTION_STRING|DATABASE_URL|SIGNING_KEY|PRIVATE_KEY)/i;

const BINARY_EXTENSIONS = new Set([
  '.zip', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.exe',
  '.dll', '.pem', '.key', '.p12', '.pfx', '.crt', '.cer', '.woff', '.woff2',
  '.ttf', '.eot', '.dat', '.db', '.sqlite', '.bak',
]);

// Candidate extraction for fingerprint matching. A previously exposed value may
// appear quoted in code or bare in prose (for example Markdown), so both shapes
// are fingerprinted. Candidates are normalized only by trimming surrounding
// quote/whitespace boundaries; interior characters are never altered.
const CANDIDATE_QUOTED = /['"`][^'"`\n]{6,200}['"`]/g;
const CANDIDATE_BARE =
  /(?:^|[\s"'([{<>:=,;])([A-Za-z0-9][A-Za-z0-9_@.\-!*$%^&+#]{5,79})(?=[\s"')\]}<>:=,;.!?]|$)/g;
const MAX_CANDIDATES_PER_FILE = 20000;

// Self-test hook: additionally scan explicit paths (repo-relative or absolute,
// newline separated) passed via CRED_CHECK_EXTRA_FILES. This only adds scan
// targets; it never skips files. Normal CI runs leave the variable unset.
const EXTRA_RAW = process.env.CRED_CHECK_EXTRA_FILES || '';
const EXTRA_FILES = EXTRA_RAW.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

// Allowlist for SECRET_ASSIGNMENT only (known-leak fingerprint and env-fallback
// checks always scan ALL tracked files, including these). Rationale:
//   - *.spec.* / *.test.* : unit-test fixtures use fictional credentials by design.
//   - test|tests|__mocks__|fixtures dirs: mocked data, never real production values.
//   - /i18n/locales/: static translation placeholders (e.g. example email labels).
//   - *.d.ts: generated type declarations, no runtime assignment.
function isSkippedFixture(rel) {
  return /\.(?:spec|test)\./i.test(rel) ||
    /(?:^|\/)(?:test|tests|__mocks__|fixtures?)(?:\/|$)/i.test(rel) ||
    /\/i18n\/locales\//.test(rel) ||
    /\.d\.ts$/.test(rel);
}

function sha256Hex(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function scanForKnownLeaks(rel, content, findings) {
  const raw = content.replace(/\u0000/g, '');
  let matches = 0;
  let candidates = 0;
  const emit = (id) => {
    if (matches < 5) {
      findings.push(`${rel}: known leaked credential fingerprint matched (${id})`);
      matches += 1;
    }
  };
  const check = (candidate) => {
    if (candidates >= MAX_CANDIDATES_PER_FILE) return;
    candidates += 1;
    const c = candidate.replace(/^['"`]+|['"`]+$/g, '').trim();
    if (c.length < 6 || c.length > 128) return;
    const id = KNOWN_LEAKED_SHA256.get(sha256Hex(c));
    if (id) emit(id);
  };
  for (const m of raw.matchAll(CANDIDATE_QUOTED)) {
    if (matches >= 5) break;
    check(m[0]);
  }
  for (const m of raw.matchAll(CANDIDATE_BARE)) {
    if (matches >= 5) break;
    check(m[1]);
  }
}

// Safe placeholder values accepted in .env.example templates. Values that look
// live (embedded credentials or real-looking secrets) are rejected.
function isSafeEnvPlaceholder(value) {
  const v = value.trim();
  if (!v) return true;
  if (/^<[^>]*>$/.test(v)) return true;
  if (/change[_ -]?me/i.test(v)) return true;
  if (/example/i.test(v)) return true;
  if (/localhost|127\.0\.0\.1|::1/.test(v)) return true;
  if (!/[0-9!@#$%^&*]/.test(v)) return true;
  return false;
}

function scanEnvFile(rel, content, findings) {
  let lineNo = 0;
  for (const line of content.split(/\r?\n/)) {
    lineNo += 1;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(".*?"|'.*?'|[^#\s][^#]*)\s*$/);
    if (!m) continue;
    const name = m[1];
    if (!SECRET_ENV_NAME.test(name)) continue;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    value = value.trim();
    if (!value) continue;
    if (isSafeEnvPlaceholder(value)) continue;
    findings.push(`${rel}:${lineNo}: ${name} holds a live-looking credential value`);
  }
}

const tracked = execSync('git ls-files', {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
  .split('\n')
  .filter(Boolean);

const scanTargets = [...tracked, ...EXTRA_FILES];
const findings = [];

for (const rel of scanTargets) {
  const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) continue;

  let content;
  try {
    content = readFileSync(isAbsolute(rel) ? rel : new URL(`../${rel}`, import.meta.url), 'utf8');
  } catch {
    continue;
  }

  scanForKnownLeaks(rel, content, findings);

  const isEnvFile = /(^|\/)[^/]+\.env(\.[^/]+)?$/i.test(rel);
  if (isEnvFile) {
    scanEnvFile(rel, content, findings);
    continue;
  }

  const isCode = /\.(?:ts|js|mjs|cjs|ps1|py|sh)$/i.test(rel);
  if (!isCode) continue;

  for (const m of content.matchAll(SECRET_ENV_FALLBACK)) {
    findings.push(`${rel}: secret env '${m[1]}' has literal fallback`);
  }

  if (isSkippedFixture(rel)) continue;
  for (const m of content.matchAll(SECRET_ASSIGNMENT)) {
    findings.push(`${rel}: hardcoded secret literal assigned to ${m.groups.var}`);
  }
}

if (findings.length > 0) {
  console.error('credentials:check FAILED:');
  for (const f of findings) console.error(`  - ${f}`);
  console.error(`${findings.length} credential issue(s) found in tracked files.`);
  process.exit(1);
}

console.log('credentials:check OK: no hardcoded credentials in tracked files.');
