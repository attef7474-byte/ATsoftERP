import { PRINT_ROW_LIMIT, printFormatters, PrintPreparationError, type PrintColumn, type PrintField, type PrintPage } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

export interface PartnerPrintRow {
  id: string; code: string; name: string; type: string; email?: string | null; phone?: string | null; isBlocked?: boolean | null;
}
export interface PartnersPrintData extends PrintPage<PartnerPrintRow> {
  cards: Array<{ label: string; value: number }>;
  byType: Array<{ type: string; count: number }>;
}

function partnerType(value: string, t: PrintTranslate, locale: Locale): string {
  if (value === 'SUPPLIER') return t('common.supplier');
  if (value === 'CUSTOMER') return t('common.customer');
  if (value === 'BOTH') return t('common.both');
  return translateEnum(value, locale);
}

/** Business contact data only; no bank, tax or personal identity numbers are printed. */
export function systemPartnersPrintModel(snapshot: ReportPrintSnapshot<PartnersPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params } = snapshot, fmt = printFormatters(locale);
  if (!Array.isArray(data.rows) || data.rows.length > PRINT_ROW_LIMIT) throw new PrintPreparationError('limitExceeded');
  const filters: PrintField[] = [];
  if (params.search) filters.push({ label: t('common.search'), value: String(params.search) });
  if (params.type) filters.push({ label: t('maintenance.type'), value: partnerType(String(params.type), t, locale) });
  const columns: PrintColumn<PartnerPrintRow>[] = [
    { key: 'code', label: t('common.code'), value: row => row.code, align: 'start', priority: 1, width: 14, direction: 'ltr' },
    { key: 'name', label: t('common.name'), value: row => row.name, align: 'start', priority: 1, width: 28 },
    { key: 'type', label: t('maintenance.type'), value: row => partnerType(row.type, t, locale), align: 'start', priority: 2, width: 14 },
    { key: 'email', label: t('common.email'), value: row => row.email, align: 'start', priority: 2, width: 20, direction: 'ltr' },
    { key: 'phone', label: t('common.phone'), value: row => row.phone, align: 'start', priority: 2, width: 14, direction: 'ltr' },
    { key: 'status', label: t('reports.status'), value: row => row.isBlocked ? t('reports.inactive') : t('reports.active'), align: 'start', priority: 2, width: 10 },
  ];
  return {
    mode: 'REPORT', title: t('reports.partnersReport'), paperSize: 'A4', orientation: 'portrait',
    scopeLabel: t('reports.printDocument.partnersScope'), filters,
    summary: (data.cards || []).map(card => ({ label: t(`reports.${card.label}`), value: fmt.number(card.value) })),
    sections: [
      { columns, rows: data.rows },
      { title: t('reports.printDocument.partnerDistribution'), rows: data.byType || [], columns: [
        { key: 'type', label: t('maintenance.type'), value: row => partnerType(row.type, t, locale), align: 'start', priority: 1, width: 80 },
        { key: 'count', label: t('reports.total'), value: row => fmt.number(row.count), align: 'end', priority: 2, width: 20, direction: 'ltr' },
      ] },
    ],
    notes: [t('reports.printDocument.partnersSecurityNote')],
  };
}
