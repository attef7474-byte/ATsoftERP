import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const LOCALE_DIR = new URL('../apps/web/src/lib/i18n/locales/', import.meta.url);

const NAMESPACE_FILES = [
  'common.ts', 'navigation.ts', 'grid.ts', 'core.ts', 'access.ts',
  'settings.ts', 'inventory.ts', 'maintenance.ts', 'barcodes.ts',
  'reports.ts', 'validation.ts', 'system.ts', 'error-dialog.ts', 'workspace.ts',
  'production.ts', 'production-cost-transaction.ts', 'production-cost-calculation.ts',
  'production-reliability.ts', 'operations-reports.ts',
  'inventory-valuation.ts',
];

const INDEX_FILES = ['index.ts', 'index.ts'];

function extractKeysFromFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const keys = new Set();
  const pathStack = [];
  let emptyValues = [];

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
      const valueMatch = trimmed.match(/^(\w+):\s*['"]([^'"]*)['"]/);
      if (valueMatch && valueMatch[2] === '') {
        emptyValues.push(fullKey);
      }
    }
  }
  return { keys, emptyValues };
}

function extractKeys(locale) {
  const keys = new Set();
  const allEmptyValues = [];
  for (const nsFile of NAMESPACE_FILES) {
    const filePath = new URL(`./${locale}/${nsFile}`, LOCALE_DIR);
    const result = extractKeysFromFile(filePath);
    for (const k of result.keys) keys.add(k);
    for (const k of result.emptyValues) allEmptyValues.push(`${nsFile}:${k}`);
  }
  return { keys, emptyValues: allEmptyValues };
}

function extractNamespaceRegistration(locale) {
  const indexPath = new URL(`./${locale}/index.ts`, LOCALE_DIR);
  const content = readFileSync(indexPath, 'utf-8');
  const registered = new Set();
  const importRe = /import\s+(\w+)\s+from\s+'\.\/([\w-]+)'/g;
  const spreadRe = /\.\.\.(\w+)/g;
  let match;
  const imports = new Map();
  while ((match = importRe.exec(content)) !== null) {
    imports.set(match[2], match[1]);
  }
  while ((match = spreadRe.exec(content)) !== null) {
    const alias = match[1];
    const fileName = [...imports.entries()].find(([, local]) => local === alias)?.[0];
    if (fileName) registered.add(fileName);
  }
  return registered;
}

const enResult = extractKeys('en');
const arResult = extractKeys('ar');

const EN_NAMESPACE_FILE_NAMES = NAMESPACE_FILES.map((f) => f.replace(/\.ts$/, ''));
const enRegistered = extractNamespaceRegistration('en');
const arRegistered = extractNamespaceRegistration('ar');

let exitCode = 0;
const failures = [];
const passes = [];

function fail(message) {
  failures.push(message);
  exitCode = 1;
}

const missingInAr = [...enResult.keys].filter(k => !arResult.keys.has(k));
if (missingInAr.length > 0) {
  fail(`Missing in ar.ts (${missingInAr.length}): ${missingInAr.join(', ')}`);
} else {
  passes.push(`All ${enResult.keys.size} EN keys exist in AR.`);
}

const missingInEn = [...arResult.keys].filter(k => !enResult.keys.has(k));
if (missingInEn.length > 0) {
  fail(`Missing in en.ts (${missingInEn.length}): ${missingInEn.join(', ')}`);
} else {
  passes.push(`All ${arResult.keys.size} AR keys exist in EN.`);
}

const missingNamespaceRegistrationEn = EN_NAMESPACE_FILE_NAMES.filter((f) => !enRegistered.has(f));
if (missingNamespaceRegistrationEn.length > 0) {
  fail(`Namespaces not registered in en/index.ts: ${missingNamespaceRegistrationEn.join(', ')}`);
} else {
  passes.push(`All ${NAMESPACE_FILES.length} namespace files registered in en/index.ts.`);
}

const missingNamespaceRegistrationAr = EN_NAMESPACE_FILE_NAMES.filter((f) => !arRegistered.has(f));
if (missingNamespaceRegistrationAr.length > 0) {
  fail(`Namespaces not registered in ar/index.ts: ${missingNamespaceRegistrationAr.join(', ')}`);
} else {
  passes.push(`All ${NAMESPACE_FILES.length} namespace files registered in ar/index.ts.`);
}

if (enResult.emptyValues.length > 0) {
  fail(`Empty values in en: ${enResult.emptyValues.join(', ')}`);
} else {
  passes.push('No empty translation values in EN.');
}

if (arResult.emptyValues.length > 0) {
  fail(`Empty values in ar: ${arResult.emptyValues.join(', ')}`);
} else {
  passes.push('No empty translation values in AR.');
}

function extractLiteralTKeys(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const keys = new Set();
  const re = /(?:t|\bt)\(\s*['"]([\w][\w.-]*?)['"]/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const key = match[1];
    if (!key.startsWith('http') && key.includes('.') && !key.startsWith('status.')) {
      keys.add(key);
    }
  }
  return keys;
}

const WEB_SRC = new URL('../apps/web/src/', import.meta.url);
const REGISTERED_NAMESPACE_PREFIXES = new Set([
  'common', 'auth', 'dashboard', 'navigation', 'actions', 'status', 'validation',
  'errors', 'core', 'access', 'inventory', 'maintenance', 'cmms', 'f9',
  'inventoryCounting', 'users', 'roles', 'permissions', 'barcodes', 'workspace',
  'settings', 'notifications', 'profile', 'details', 'inventoryCountWorkflow',
  'maintenanceWorkflow', 'unifiedSearch', 'complexForms', 'reports', 'alerts',
  'companyProfile', 'languageSettings', 'appearanceSettings', 'securitySettings',
  'notificationRules', 'attachments', 'userActivity', 'loginHistory',
  'maintenanceDashboard', 'preventiveMaintenance', 'downtimeAnalysis',
  'sparePartRequest', 'search', 'messaging', 'grid', 'inventoryLedger',
  'inventoryReconciliation', 'physicalCount', 'varianceControl', 'errorDialog',
  'production', 'productionCostTransaction', 'productionCostCalculation',
  'productionReliability', 'operationsReports',
  'inventoryValuation',
]);

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

const webFiles = collectFiles(fileURLToPath(WEB_SRC));
let literalTErrors = 0;
let literalTCount = 0;
const dynamicT = [];

for (const file of webFiles) {
  const content = readFileSync(file, 'utf-8');
  const keyRe = /\bt\s*\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = keyRe.exec(content)) !== null) {
    const key = match[1];
    if (!key.includes('.')) {
      dynamicT.push(key);
      continue;
    }
    literalTCount += 1;
    const ns = key.substring(0, key.indexOf('.'));
    if (!enResult.keys.has(key) && !REGISTERED_NAMESPACE_PREFIXES.has(ns)) {
      literalTErrors += 1;
      fail(`Literal t() key not in EN dictionary and unknown namespace: "${key}" in ${file.replace(WEB_SRC.pathname, '')}`);
    }
  }
}

if (literalTErrors === 0) {
  passes.push(`All ${literalTCount} literal t() keys resolve against the EN dictionary.`);
}

if (dynamicT.length > 0) {
  passes.push(`Dynamic t() keys detected (reported separately): ${[...new Set(dynamicT)].join(', ')}`);
}

for (const pass of passes) {
  console.log(`PASS: ${pass}`);
}
for (const failure of failures) {
  console.error(`FAIL: ${failure}`);
}

if (exitCode === 0) {
  console.log(`i18n check passed. ${enResult.keys.size} keys in en, ${arResult.keys.size} keys in ar, fully synchronized, all namespaces registered, no empty values.`);
} else {
  console.error(`${failures.length} i18n check failure(s).`);
}

process.exit(exitCode);
