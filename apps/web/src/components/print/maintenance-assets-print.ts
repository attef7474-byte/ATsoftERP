import { printFormatters, type PrintColumn, type PrintPage } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

export interface AssetPrintRow {
  id: string; code: string; name: string; category?: { name?: string } | null;
  location?: string | null; status: string; createdAt?: string;
}
export interface AssetsPrintData extends PrintPage<AssetPrintRow> {
  cards: Array<{ label: string; value: number }>;
  byStatus?: Array<{ status: string; count: number }>;
}
export function maintenanceAssetsPrintModel(snapshot: ReportPrintSnapshot<AssetsPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params } = snapshot, fmt = printFormatters(locale);
  const filters = [];
  if (params.search) filters.push({ label: t('common.search'), value: String(params.search) });
  if (params.status) filters.push({ label: t('reports.status'), value: translateEnum(String(params.status), locale) });
  const columns: PrintColumn<AssetPrintRow>[] = [
    { key: 'code', label: t('common.code'), value: row => row.code, align: 'start', priority: 1, width: 20, direction: 'ltr' },
    { key: 'name', label: t('common.name'), value: row => row.name, align: 'start', priority: 1, width: 25 },
    { key: 'category', label: t('reports.category'), value: row => row.category?.name, align: 'start', priority: 2, width: 16 },
    { key: 'location', label: t('maintenance.location'), value: row => row.location, align: 'start', priority: 2, width: 15 },
    { key: 'status', label: t('reports.status'), value: row => translateEnum(row.status, locale), align: 'start', priority: 2, width: 12 },
    { key: 'createdAt', label: t('common.createdAt'), value: row => fmt.date(row.createdAt), align: 'center', priority: 2, width: 16, direction: 'ltr' },
  ];
  return {
    mode: 'REGISTER', title: t('reports.assetsReport'), paperSize: 'A4', orientation: 'portrait', scopeLabel: t('reports.printDocument.allFiltered'), filters,
    summary: data.cards.map(card => ({ label: t(`reports.${card.label}`), value: fmt.number(card.value) })),
    sections: [{ columns, rows: data.rows }, ...(data.byStatus?.length ? [{ title: t('reports.status'), columns: [
      { key: 'status', label: t('reports.status'), value: (row: { status: string; count: number }) => translateEnum(row.status, locale), align: 'start' as const, priority: 1 as const, width: 70 },
      { key: 'count', label: t('reports.count'), value: (row: { count: number }) => fmt.number(row.count), align: 'end' as const, priority: 2 as const, width: 30 },
    ], rows: data.byStatus }] : [])],
    notes: [t('reports.printDocument.assetsScopeNote')],
  };
}
