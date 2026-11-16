import { PRINT_ROW_LIMIT, printFormatters, PrintPreparationError, type PrintColumn, type PrintField, type PrintPage } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

export interface NotificationPrintRow {
  id: string; title: string; type?: string | null; read?: boolean | null; createdAt?: string | null;
}
export interface NotificationsPrintData extends PrintPage<NotificationPrintRow> {
  cards: Array<{ label: string; value: number }>;
  byType: Array<{ type: string; count: number }>;
}

function notificationType(value: string | null | undefined, t: PrintTranslate, locale: Locale): string {
  if (!value) return '-';
  const known: Record<string, string> = {
    INFO: t('notifications.INFO'), WARNING: t('notifications.WARNING'), ERROR: t('notifications.ERROR'), SUCCESS: t('notifications.SUCCESS'),
  };
  return known[value] || translateEnum(value, locale);
}

/** Titles and types only; message bodies and links are deliberately excluded. */
export function systemNotificationsPrintModel(snapshot: ReportPrintSnapshot<NotificationsPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params } = snapshot, fmt = printFormatters(locale);
  if (!Array.isArray(data.rows) || data.rows.length > PRINT_ROW_LIMIT) throw new PrintPreparationError('limitExceeded');
  const filters: PrintField[] = [];
  if (params.search) filters.push({ label: t('common.search'), value: String(params.search) });
  const columns: PrintColumn<NotificationPrintRow>[] = [
    { key: 'title', label: t('common.name'), value: row => row.title, align: 'start', priority: 1, width: 46 },
    { key: 'type', label: t('reports.category'), value: row => notificationType(row.type, t, locale), align: 'start', priority: 2, width: 18 },
    { key: 'read', label: t('notifications.read'), value: row => row.read ? t('notifications.read') : t('notifications.unread'), align: 'start', priority: 2, width: 14 },
    { key: 'createdAt', label: t('common.createdAt'), value: row => fmt.dateTime(row.createdAt), align: 'center', priority: 1, width: 22, direction: 'ltr' },
  ];
  return {
    mode: 'REPORT', title: t('reports.notificationsReport'), paperSize: 'A4', orientation: 'portrait',
    scopeLabel: t('reports.printDocument.notificationsScope'), filters,
    periodStart: params.dateFrom ? String(params.dateFrom) : undefined,
    periodEnd: params.dateTo ? String(params.dateTo) : undefined,
    summary: (data.cards || []).map(card => ({ label: t(`reports.${card.label}`), value: fmt.number(card.value) })),
    sections: [
      { columns, rows: data.rows },
      { title: t('reports.printDocument.notificationDistribution'), rows: data.byType || [], columns: [
        { key: 'type', label: t('reports.category'), value: row => notificationType(row.type, t, locale), align: 'start', priority: 1, width: 80 },
        { key: 'count', label: t('reports.total'), value: row => fmt.number(row.count), align: 'end', priority: 2, width: 20, direction: 'ltr' },
      ] },
    ],
    notes: [t('reports.printDocument.notificationsSecurityNote')],
  };
}
