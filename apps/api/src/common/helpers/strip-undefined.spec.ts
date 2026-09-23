import { stripUndefined } from './strip-undefined';

describe('stripUndefined', () => {
  it('drops keys whose value is strictly undefined (class-transformer own-property semantics)', () => {
    const input = { availabilityTarget: undefined, performanceTarget: undefined, notes: 'updated', effectiveTo: undefined };
    const out = stripUndefined(input as Record<string, unknown>);
    expect(out).toEqual({ notes: 'updated' });
    expect(Object.keys(out)).toEqual(['notes']);
  });

  it('preserves explicit null so field clearing still works', () => {
    const out = stripUndefined({ machineId: null, notes: 'keep' });
    expect(out).toEqual({ machineId: null, notes: 'keep' });
  });

  it('keeps falsy but defined values such as zero and empty string', () => {
    const out = stripUndefined({ plannedQuantity: 0, notes: '', tolerancePercent: 0, retained: false });
    expect(out).toEqual({ plannedQuantity: 0, notes: '', tolerancePercent: 0, retained: false });
  });

  it('treats null and undefined distinctly inside the same object', () => {
    const out = stripUndefined({ a: null, b: undefined, c: 0x7b });
    expect(Object.keys(out)).toEqual(['a', 'c']);
  });
});