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

  it('declares every React hook before the first early-return guard on the maintenance request page', () => {
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

  /**
   * R4R — the condition-balances lookup moved with the stock-issue modal.
   *
   * It used to live on the maintenance request page (the R2-C crash: a conditional
   * hook behind a loading guard). The stock-issue transaction itself moved to the
   * canonical spare-part-issues screen, so that screen now owns the lookup and must
   * satisfy the SAME Rules-of-Hooks invariant. The assertion follows the behaviour
   * instead of being deleted.
   */
  it('declares the condition-balances effect on the canonical spare-part-issues page, before any early-return guard', () => {
    const src = read('src/app/admin/maintenance/spare-part-issues/page.tsx');

    const effectIdx = src.indexOf('spare-part-conditions/by-spare-part');
    expect(effectIdx).toBeGreaterThan(-1);

    // The lookup must live inside a useEffect, not in render-body conditionals.
    const effectStart = src.lastIndexOf('useEffect(', effectIdx);
    const effectEnd = src.indexOf('}, [modalOpen', effectIdx);
    expect(effectStart).toBeGreaterThan(-1);
    expect(effectEnd).toBeGreaterThan(effectIdx);

    // If the page ever gains an early-return guard, the effect must still precede it.
    const guardMatch = src.match(/return\s+<(?:LoadingState|ErrorState)\b/);
    if (guardMatch && guardMatch.index != null) {
      expect(guardMatch.index).toBeGreaterThan(effectIdx);
    }

    // And every hook on the new page must still precede the first guard.
    const lines = src.split('\n');
    const hookLines: number[] = [];
    const guardLines: number[] = [];
    lines.forEach((line, idx) => {
      if (HOOK_RE.test(line)) hookLines.push(idx + 1);
      if (GUARD_RE.test(line)) guardLines.push(idx + 1);
    });
    if (guardLines.length > 0) {
      const firstGuard = Math.min(...guardLines);
      expect(hookLines.filter((n) => n > firstGuard)).toEqual([]);
    }
  });
});
