import { readFileSync, readdirSync } from 'fs';

const LOCALE_DIR = new URL('../apps/web/src/lib/i18n/locales/', import.meta.url);

const NAMESPACE_FILES = [
  'common.ts', 'navigation.ts', 'grid.ts', 'core.ts', 'access.ts',
  'settings.ts', 'inventory.ts', 'maintenance.ts', 'barcodes.ts',
  'reports.ts', 'validation.ts', 'system.ts',
];

function extractKeysFromFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const keys = new Set();
  const pathStack = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('import') || trimmed.startsWith('export')) continue;
    const closeIdx = trimmed.indexOf('}');
    if (closeIdx === 0 && pathStack.length > 0) {
      pathStack.pop();
      continue;
    }
    const keyMatch = trimmed.match(/^(\w+):\s*[{]/);
    if (keyMatch) {
      pathStack.push(keyMatch[1]);
      continue;
    }
    const valMatch = trimmed.match(/^(\w+):\s*['"]/);
    if (valMatch) {
      const fullKey = [...pathStack, valMatch[1]].join('.');
      keys.add(fullKey);
    }
  }
  return keys;
}

function extractKeys(locale) {
  const keys = new Set();
  for (const nsFile of NAMESPACE_FILES) {
    const filePath = new URL(`./${locale}/${nsFile}`, LOCALE_DIR);
    const nsKeys = extractKeysFromFile(filePath);
    for (const k of nsKeys) keys.add(k);
  }
  return keys;
}

const enKeys = extractKeys('en');
const arKeys = extractKeys('ar');

let exitCode = 0;

const missingInAr = [...enKeys].filter(k => !arKeys.has(k));
if (missingInAr.length > 0) {
  console.error(`Missing in ar.ts (${missingInAr.length}):`);
  missingInAr.forEach(k => console.error(`  ${k}`));
  exitCode = 1;
}

const missingInEn = [...arKeys].filter(k => !enKeys.has(k));
if (missingInEn.length > 0) {
  console.error(`Missing in en.ts (${missingInEn.length}):`);
  missingInEn.forEach(k => console.error(`  ${k}`));
  exitCode = 1;
}

if (exitCode === 0) {
  console.log(`i18n check passed. ${enKeys.size} keys in en.ts, ${arKeys.size} keys in ar.ts, fully synchronized.`);
}

process.exit(exitCode);
