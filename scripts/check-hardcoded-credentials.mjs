#!/usr/bin/env node
/**
 * check-hardcoded-credentials.mjs
 *
 * Fails the build when tracked files contain real credential literals:
 *   1. Previously-leaked real credentials (any tracked file).
 *   2. Environment-with-secret-fallback patterns in code, e.g.
 *      `process.env.DB_PASSWORD || "admin123"`.
 *   3. Obvious hardcoded secret assignments in executable code
 *      (skips unit-test fixtures, placeholders, and documentation).
 *
 * Run: node scripts/check-hardcoded-credentials.mjs
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Stored as char codes so no verbatim secret literal exists in this source.
// (SHA-256 fingerprints are also valid; char codes keep the detector self-scannable.)
const KNOWN_LEAKED_LITERALS = [
  [65, 100, 109, 105, 110, 64, 49, 50, 51, 52, 53, 54],
  [80, 114, 111, 111, 102, 80, 97, 115, 115, 64, 50, 48, 50, 54, 33],
  [79, 112, 101, 114, 97, 116, 105, 111, 110, 115, 80, 114, 111, 111, 102, 64, 50, 48, 50, 54, 33],
].map((codes) => String.fromCharCode(...codes));

const SECRET_ENV_FALLBACK =
  /process\.env\.([A-Z0-9_]*(?:PASSWORD|PASS|SECRET|TOKEN|API_KEY|API_SECRET|APISECRET|CREDENTIAL|CONNECTION_STRING)[A-Z0-9_]*|DATABASE_URL)\s*\|\|\s*["']([^"']{1,})["']/gi;

const SECRET_ASSIGNMENT =
  /(?<!["'\w])(?:[A-Za-z0-9_]*_)?(?:password|pass|pwd|secret|apikey|api_key|api_secret|access_token|connection_string|connectionstring|jwt_secret)\s*[:=]\s*["'](?=[^"']*[0-9!@#$%^&*])[^"']{6,}["']/gi;

const BINARY_EXTENSIONS = new Set([
  '.zip', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.exe',
  '.dll', '.pem', '.key', '.p12', '.pfx', '.crt', '.cer', '.woff', '.woff2',
  '.ttf', '.eot', '.dat', '.db', '.sqlite', '.bak',
]);

// Allowlist for SECRET_ASSIGNMENT only (leaked-literal and env-fallback checks
// still apply to ALL tracked files, including these). Rationale:
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

const tracked = execSync('git ls-files', {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
  .split('\n')
  .filter(Boolean);

const findings = [];

for (const rel of tracked) {
  // Self-exclusion with rationale: this detector's own source documents the
  // exact patterns it scans for (e.g. the docstring example `process.env.DB_PASSWORD
  // || "admin123"`), which the SECRET_ENV_FALLBACK regex would otherwise match.
  if (rel === 'scripts/check-hardcoded-credentials.mjs') continue;
  if (rel.endsWith('.env.example')) continue;
  const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) continue;

  let content;
  try {
    content = readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
  } catch {
    continue;
  }

  for (const literal of KNOWN_LEAKED_LITERALS) {
    if (content.includes(literal)) {
      findings.push(`${rel}: leaked credential literal '${literal}' present`);
    }
  }

  const isCode = /\.(?:ts|js|mjs|cjs|ps1|py|sh)$/i.test(rel);
  if (!isCode) continue;

  for (const m of content.matchAll(SECRET_ENV_FALLBACK)) {
    findings.push(`${rel}: secret env '${m[1]}' has literal fallback`);
  }

  if (isSkippedFixture(rel)) continue;
  for (const m of content.matchAll(SECRET_ASSIGNMENT)) {
    findings.push(`${rel}: hardcoded secret literal assigned to ${m[0].split(/[:=]/)[0].trim()}`);
  }
}

if (findings.length > 0) {
  console.error('credentials:check FAILED:');
  for (const f of findings) console.error(`  - ${f}`);
  console.error(`${findings.length} credential issue(s) found in tracked files.`);
  process.exit(1);
}

console.log('credentials:check OK: no hardcoded credentials in tracked files.');
