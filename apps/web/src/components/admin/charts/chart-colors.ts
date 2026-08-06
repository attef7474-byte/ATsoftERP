export const CHART_PALETTE = [
  '#2563eb',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#14b8a6',
];

export function chartColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}
