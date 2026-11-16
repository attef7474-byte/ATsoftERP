import { PRINT_ROW_LIMIT, printFormatters, PrintPreparationError, type PrintColumn, type PrintField, type PrintPage } from '../../lib/print';
import { translateStatus } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

export interface UserActivityPrintRow {
  id: string; name: string; email?: string | null; status: string; lastLoginAt?: string | null; createdAt?: string | null;
}
export interface UserActivityPrintData extends PrintPage<UserActivityPrintRow> {
  cards: Array<{ label: string; value: number }>;
}

/** Account contact data is personal; no password, token or session field is printed. */
export function systemUserActivityPrintModel(snapshot: ReportPrintSnapshot<UserActivityPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params } = snapshot, fmt = printFormatters(locale);
  if (!Array.isArray(data.rows) || data.rows.length > PRINT_ROW_LIMIT) throw new PrintPreparationError('limitExceeded');
  const filters: PrintField[] = [];
  if (params.search) filters.push({ label: t('common.search'), value: String(params.search) });
  if (params.status) filters.push({ label: t('reports.status'), value: translateStatus(String(params.status), locale) });
  const columns: PrintColumn<UserActivityPrintRow>[] = [
    { key: 'name', label: t('common.name'), value: row => row.name, align: 'start', priority: 1, width: 24 },
    { key: 'email', label: t('common.email'), value: row => row.email, align: 'start', priority: 1, width: 28, direction: 'ltr' },
    { key: 'status', label: t('reports.status'), value: row => translateStatus(row.status, locale), align: 'start', priority: 2, width: 14 },
    { key: 'lastLoginAt', label: t('reports.lastLogin'), value: row => fmt.dateTime(row.lastLoginAt), align: 'center', priority: 2, width: 18, direction: 'ltr' },
    { key: 'createdAt', label: t('common.createdAt'), value: row => fmt.date(row.createdAt), align: 'center', priority: 2, width: 16, direction: 'ltr' },
  ];
  return {
    mode: 'REPORT', title: t('reports.userActivityReport'), paperSize: 'A4', orientation: 'portrait',
    scopeLabel: t('reports.printDocument.userActivityScope'), filters,
    summary: (data.cards || []).map(card => ({ label: t(`reports.${card.label}`), value: fmt.number(card.value) })),
    sections: [{ columns, rows: data.rows }],
    notes: [t('reports.printDocument.userActivitySecurityNote')],
  };
}
