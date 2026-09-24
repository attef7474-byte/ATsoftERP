import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(webRoot, rel), 'utf8');

const HOOK_RE = /\buse(?:State|Effect|Ref|Memo|Callback|Context)\b/g;
const GUARD_RE = /return\s+<(?:LoadingState|ErrorState)\b/;

describe('request detail page — React Rules-of-Hooks ordering (regression)', () => {
  it('declares every React hook before the first early-return guard', () => {
    const src = read('src/app/admin/maintenance/requests/[id]/page.tsx');
    const lines = src.split('\n');

    const hookLines: number[] = [];
    const guardLines: number[] = [];

    lines.forEach((line, idx) => {
      if (HOOK_RE.test(line)) hookLines.push(idx + 1);
      if (GUARD_RE.test(line)) guardLines.push(idx + 1);
    });

    // All base hooks must run unconditionally before any early return.
    const firstGuard = Math.min(...guardLines);
    const hooksAfterGuard = hookLines.filter((n) => n > firstGuard);
    expect(hooksAfterGuard).toEqual([]);
    expect(hookLines.length).toBeGreaterThanOrEqual(3);
  });

  it('declares the condition-balances effect before the loading guard (the R2-C crash fix)', () => {
    const src = read('src/app/admin/maintenance/requests/[id]/page.tsx');
    const effectIdx = src.indexOf('useEffect(() => {\n    if (!stockIssueLineId || !partLines.length)');
    const guardIdx = src.indexOf('if (loading) return <LoadingState />;');
    expect(effectIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeGreaterThan(effectIdx);
  });
});