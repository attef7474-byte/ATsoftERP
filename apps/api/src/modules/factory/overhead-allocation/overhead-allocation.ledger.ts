import {
  OVERHEAD_ALLOCATION_LINE_SOURCE_TYPE,
  OVERHEAD_EVENT_TYPE,
} from '../production-cost/production-cost.constants';

export const OVERHEAD_ALLOCATION_LEDGER_POST_ACTION = 'post' as const;
export const OVERHEAD_ALLOCATION_LEDGER_REVERSE_ACTION = 'reverse' as const;

/**
 * COST-R2D-B3 line-qualified source fingerprint. The standard 3-part ledger
 * fingerprint (`sourceType:sourceId:eventType`) would collide across lines of the
 * same allocation (the allocation id is shared); the frozen 4-part form is unique
 * per allocation line and still well under the NVARCHAR(1000) column width.
 */
export function overheadAllocationLedgerFingerprint(allocationId: string, lineId: string): string {
  return `${OVERHEAD_ALLOCATION_LINE_SOURCE_TYPE}:${allocationId}:${lineId}:${OVERHEAD_EVENT_TYPE}`;
}

/**
 * Deterministic single-use-per-tenant request identity for a B3 posting lifecycle.
 * `generation` increments every time the line is (re)posted; a reversal carries the
 * SAME generation as the live PRIMARY it offsets.
 */
export function overheadAllocationClientRequestId(allocationId: string, lineId: string, generation: number, action: string): string {
  return `overhead-allocation:${allocationId}:${lineId}:${generation}:${action}`;
}

const CLIENT_REQUEST_PATTERN = /^overhead-allocation:[^:]+:[^:]+:(\d+):(?:post|reverse)$/;

/** Parses the generation out of a B3 ledger clientRequestId; null when not in B3 form. */
export function parseOverheadAllocationGeneration(clientRequestId: string | null | undefined): number | null {
  if (!clientRequestId) return null;
  const match = CLIENT_REQUEST_PATTERN.exec(clientRequestId);
  return match ? Number(match[1]) : null;
}

/**
 * Next posting generation for an allocation line. The frozen contract derives it from
 * the existing PRIMARY rows of that line: fresh line -> 1, after one reversal/re-post
 * -> 2, and so on. Safe under the shared overhead allocation boundary (Serializable).
 */
export function nextOverheadAllocationGeneration(primaryRowCount: number): number {
  return primaryRowCount + 1;
}

export { OVERHEAD_ALLOCATION_LINE_SOURCE_TYPE, OVERHEAD_EVENT_TYPE };