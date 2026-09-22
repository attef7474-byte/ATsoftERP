import {
  nextOverheadAllocationGeneration,
  overheadAllocationClientRequestId,
  overheadAllocationLedgerFingerprint,
  parseOverheadAllocationGeneration,
  OVERHEAD_ALLOCATION_LEDGER_POST_ACTION,
  OVERHEAD_ALLOCATION_LEDGER_REVERSE_ACTION,
} from './overhead-allocation.ledger';

describe('COST-R2D-B3 overhead-allocation ledger identity helpers', () => {
  it('line-qualified fingerprint is sourceType:allocationId:lineId:OVERHEAD', () => {
    expect(overheadAllocationLedgerFingerprint('allocation-1', 'line-2')).toBe('OVERHEAD_ALLOCATION_LINE:allocation-1:line-2:OVERHEAD');
    expect(overheadAllocationLedgerFingerprint('allocation-1', 'line-3')).not.toBe(overheadAllocationLedgerFingerprint('allocation-1', 'line-2'));
  });
  it('clientRequestId embeds allocation, line, generation and action', () => {
    expect(overheadAllocationClientRequestId('a', 'l', 1, OVERHEAD_ALLOCATION_LEDGER_POST_ACTION)).toBe('overhead-allocation:a:l:1:post');
    expect(overheadAllocationClientRequestId('a', 'l', 1, OVERHEAD_ALLOCATION_LEDGER_REVERSE_ACTION)).toBe('overhead-allocation:a:l:1:reverse');
  });
  it('parses the generation of a B3 request id and rejects non-B3 forms', () => {
    expect(parseOverheadAllocationGeneration('overhead-allocation:a:l:1:post')).toBe(1);
    expect(parseOverheadAllocationGeneration('overhead-allocation:a:l:42:reverse')).toBe(42);
    expect(parseOverheadAllocationGeneration('overhead-allocation:a:l:0:post')).toBe(0);
    expect(parseOverheadAllocationGeneration('overhead-allocation:a:l:x:post')).toBe(null);
    expect(parseOverheadAllocationGeneration('overhead-allocation:a:l:1:cancel')).toBe(null);
    expect(parseOverheadAllocationGeneration(null)).toBe(null);
    expect(parseOverheadAllocationGeneration(undefined)).toBe(null);
    expect(parseOverheadAllocationGeneration('')).toBe(null);
  });
  it('next generation is one past the existing PRIMARY count (fresh line -> 1)', () => {
    expect(nextOverheadAllocationGeneration(0)).toBe(1);
    expect(nextOverheadAllocationGeneration(1)).toBe(2);
    expect(nextOverheadAllocationGeneration(3)).toBe(4);
  });
});