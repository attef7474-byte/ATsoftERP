import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const readLocaleFile = (lang: 'en' | 'ar', file: string) =>
  fs.readFileSync(path.resolve(webRoot, 'src/lib/i18n/locales', lang, file), 'utf8');

function extractMaintenanceKeys(src: string): Record<string, string> {
  const lines = src.split(/\r?\n/);
  const start = lines.findIndex((l) => /^    maintenance:\s*\{/.test(l));
  if (start === -1) return {};
  const out: Record<string, string> = {};
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^    \},/.test(line) || /^    \}$/.test(line)) break;
    const kv = line.match(/^\s{8}([A-Za-z][\w]*):\s*'([^']*)'/);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
}

const R2_D_KEYS: Array<[string, string]> = [
  ['usedRequiresStockIssue', 'markUsed guard when no physical stock issue exists'],
  ['partTerminalCannotCancel', 'cancel guard on terminal parts (takes {status})'],
  ['partNotEditableInStatus', 'update guard on non-DRAFT parts (takes {status})'],
  ['sparePartAlreadyAddedToRequest', 'reused canonical duplicate-part key'],
];

const SPARE_PART_REQUEST_KEYS = [
  'requestedParts',
  'addSparePart',
  'requestSparePart',
  'approveSparePart',
  'rejectSparePart',
  'operationalReservation',
  'markPartUsed',
  'cancelRequest',
  'issueStock',
  'stockIssueHistory',
  'requestedQuantity',
  'reason',
  'requestReason',
  'noStockDeducted',
  'noInventoryMovement',
  'returnStock',
];

function extractTopLevelNamespace(src: string, ns: string): Record<string, string> {
  const lines = src.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^    ${ns}:\\s*\\{`).test(l));
  if (start === -1) return {};
  const out: Record<string, string> = {};
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^    \},?/.test(line)) break;
    const kv = line.match(/^\s{8}([A-Za-z][\w]*):\s*'([^']*)'/);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
}

const EN_MAINTENANCE = readLocaleFile('en', 'maintenance.ts');
const AR_MAINTENANCE = readLocaleFile('ar', 'maintenance.ts');
const EN_KEYS = extractMaintenanceKeys(EN_MAINTENANCE);
const AR_KEYS = extractMaintenanceKeys(AR_MAINTENANCE);
const EN_SPR = extractTopLevelNamespace(EN_MAINTENANCE, 'sparePartRequest');
const AR_SPR = extractTopLevelNamespace(AR_MAINTENANCE, 'sparePartRequest');

describe('R2-D required-part lifecycle localization', () => {
  it.each(R2_D_KEYS)(`EN defines %s as a real human message (%s)`, (key) => {
    expect(EN_KEYS[key]).toBeTruthy();
    expect(EN_KEYS[key]).not.toBe(key);
  });

  it.each(R2_D_KEYS)(`AR defines %s as a real human message (%s)`, (key) => {
    expect(AR_KEYS[key]).toBeTruthy();
    expect(AR_KEYS[key]).not.toBe(key);
  });

  it('keeps the EN and AR key sets in sync for the R2-D keys', () => {
    for (const [key] of R2_D_KEYS) {
      expect(AR_KEYS[key]).toBeDefined();
      expect(typeof AR_KEYS[key]).toBe('string');
    }
  });

  it('defines every spare-part-request action key in the sparePartRequest namespace (EN and AR)', () => {
    for (const key of SPARE_PART_REQUEST_KEYS) {
      expect(EN_SPR[key]).toBeTruthy();
      expect(EN_SPR[key]).not.toBe(key);
      expect(AR_SPR[key]).toBeTruthy();
      expect(AR_SPR[key]).not.toBe(key);
    }
  });

  it('keeps EN and AR sparePartRequest namespaces in sync', () => {
    expect(Object.keys(AR_SPR).sort()).toEqual(Object.keys(EN_SPR).sort());
  });

  it('does not regress the sparePartRequest namespace prefix in the request detail page', () => {
    const pageSrc = fs.readFileSync(
      path.resolve(webRoot, 'src/app/admin/maintenance/requests/[id]/page.tsx'),
      'utf8',
    );
    expect(pageSrc).not.toContain("maintenance.sparePartRequest.");
    expect(pageSrc).toContain("t('sparePartRequest.");
  });
});