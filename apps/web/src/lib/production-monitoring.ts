export type MonitoringClassification = 'MANUFACTURING' | 'PACKAGING' | 'UNCLASSIFIED';
export interface MonitoringOutput {
  unit: string;
  quantity: string;
  goodQuantity: string;
  rejectQuantity: string;
}
export interface MonitoringTotals {
  now: MonitoringOutput[];
  currentShift: MonitoringOutput[] | null;
  today: MonitoringOutput[];
  monthToDate: MonitoringOutput[];
}
export interface MonitoringReference {
  id: string;
  code: string;
  name: string;
}
export interface MonitoringRow extends MonitoringReference {
  resourceType: 'LINE' | 'MACHINE';
  classification: MonitoringClassification;
  operationType: MonitoringReference | null;
  productionLine: MonitoringReference | null;
  status: 'RUNNING' | 'PAUSED' | 'IDLE';
  currentRuns: Array<{
    id: string;
    runNumber: string;
    product: MonitoringReference;
    status: string;
    output: MonitoringOutput[];
  }>;
  totals: MonitoringTotals;
  lastEventAt: string | null;
  runCount: number;
}
export interface ProductionMonitoringResponse {
  timezone: string;
  generatedAt: string;
  windows: {
    today: {
      from: string;
      to: string;
    };
    monthToDate: {
      from: string;
      to: string;
    };
    currentShift: {
      shiftId: string;
      shiftCode: string;
      shiftName: string;
      from: string;
      to: string;
    } | null;
  };
  summary: Array<{
    classification: MonitoringClassification;
    totals: MonitoringTotals;
  }>;
  lines: MonitoringRow[];
  machines: MonitoringRow[];
  dataQuality: {
    ambiguousShift: boolean;
    unassignedToMachine: MonitoringTotals;
    inaccessibleMachineRuns: number;
    unclassifiedResources: number;
    multipleActiveResources: number;
  };
  meta: {
    runCount: number;
    eventCount: number;
    elapsedMs: number;
  };
}
export function formatMonitoringQuantity(value: string, locale: string): string {
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0
  });
  const integer = formatter.format(BigInt(whole || '0'));
  const significantFraction = fraction.replace(/0+$/, '');
  const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === 'decimal')?.value || '.';
  const digits = new Intl.NumberFormat(locale, {
    useGrouping: false
  });
  const fractional = significantFraction.split('').map(digit => digits.format(Number(digit))).join('');
  const sign = negative ? formatter.formatToParts(-1).find(part => part.type === 'minusSign')?.value || '-' : '';
  return `${sign}${integer}${fractional ? separator + fractional : ''}`;
}
