/** Half-open intervals: at a transfer instant the successor alone is current. */
export function currentAssignmentWindow(now = new Date()) {
  return { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] };
}
