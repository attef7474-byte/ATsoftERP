import { printFormatters, type PrintColumn, type PrintPage } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';
export interface MachinePartPrintRow { id: string; code: string; name: string; partNumber?: string | null; quantity: number; unit: string }
export interface MachinePartsPrintData extends PrintPage<MachinePartPrintRow> { cards: Array<{ label: string; value: number }> }

function machinePartsModel(snapshot: ReportPrintSnapshot<MachinePartsPrintData>, t: PrintTranslate, locale: Locale, lowStock: boolean): PreparedReportPrint {
  const { data, params } = snapshot, fmt = printFormatters(locale);
  const columns: PrintColumn<MachinePartPrintRow>[] = [
    { key: 'code', label: t('common.code'), value: row => row.code, align: 'start', priority: 1, width: 22, direction: 'ltr' },
    { key: 'name', label: t('common.name'), value: row => row.name, align: 'start', priority: 1, width: 34 },
    { key: 'partNumber', label: t('maintenance.partNumber'), value: row => row.partNumber, align: 'start', priority: 2, width: 20, direction: 'ltr' },
    { key: 'quantity', label: t('inventoryCounting.quantity'), value: row => fmt.quantity(row.quantity), align: 'end', priority: 2, width: 14, direction: 'ltr' },
    { key: 'unit', label: t('maintenance.unit'), value: row => row.unit, align: 'center', priority: 2, width: 10, direction: 'ltr' },
  ];
  return {
    mode: 'REGISTER', title: t(lowStock ? 'reports.lowStockReport' : 'reports.partsReport'), paperSize: 'A4', orientation: 'portrait', scopeLabel: t('reports.printDocument.allFiltered'),
    filters: params.search ? [{ label: t('common.search'), value: String(params.search) }] : [],
    summary: [{ label: t(lowStock ? 'reports.lowStockItems' : 'reports.totalParts'), value: fmt.number(data.total) }],
    sections: [{ columns, rows: data.rows }], notes: [t('reports.printDocument.machinePartsQuantityNote'), ...(lowStock ? [t('reports.printDocument.lowStockThresholdNote')] : []),
      ...(params.status ? [`${t('reports.printDocument.partsIgnoredStatusNote')} ${translateEnum(String(params.status), locale)}`] : [])],
  };
}
export function maintenancePartsPrintModel(snapshot: ReportPrintSnapshot<MachinePartsPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  return machinePartsModel(snapshot, t, locale, false);
}
export function maintenanceLowStockPrintModel(snapshot: ReportPrintSnapshot<MachinePartsPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  return machinePartsModel(snapshot, t, locale, true);
}
