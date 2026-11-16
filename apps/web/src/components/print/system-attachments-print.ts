import { PRINT_ROW_LIMIT, printFormatters, PrintPreparationError, type PrintColumn, type PrintField, type PrintPage } from '../../lib/print';
import { translateEntityType } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

export interface AttachmentPrintRow {
  id: string; originalName: string; entityName?: string | null; mimeType?: string | null;
  size?: number | string | null; uploadedBy?: { name?: string } | null; createdAt?: string | null;
}
export interface AttachmentsPrintData extends PrintPage<AttachmentPrintRow> {
  cards: Array<{ label: string; value: number; unit?: string }>;
  byEntityType: Array<{ entityName: string; count: number }>;
}

/** Metadata only; file contents and download links are never printed. */
export function systemAttachmentsPrintModel(snapshot: ReportPrintSnapshot<AttachmentsPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params } = snapshot, fmt = printFormatters(locale);
  if (!Array.isArray(data.rows) || data.rows.length > PRINT_ROW_LIMIT) throw new PrintPreparationError('limitExceeded');
  const size = (value: number | string | null | undefined): string | undefined => {
    if (value == null || value === '' || !Number.isFinite(Number(value))) return undefined;
    const bytes = Number(value);
    if (bytes < 1024) return `${fmt.number(bytes)} B`;
    if (bytes < 1024 * 1024) return `${fmt.number(bytes / 1024, { maximumFractionDigits: 1 })} KB`;
    return `${fmt.number(bytes / (1024 * 1024), { maximumFractionDigits: 1 })} MB`;
  };
  const filters: PrintField[] = [];
  if (params.search) filters.push({ label: t('common.search'), value: String(params.search) });
  const columns: PrintColumn<AttachmentPrintRow>[] = [
    { key: 'originalName', label: t('common.name'), value: row => row.originalName, align: 'start', priority: 1, width: 30 },
    { key: 'entityName', label: t('reports.byEntity'), value: row => translateEntityType(row.entityName || '', locale), align: 'start', priority: 2, width: 16 },
    { key: 'mimeType', label: t('common.type'), value: row => row.mimeType, align: 'start', priority: 2, width: 14, direction: 'ltr' },
    { key: 'size', label: t('reports.totalAttachmentsSize'), value: row => size(row.size), align: 'end', priority: 2, width: 10, direction: 'ltr' },
    { key: 'uploadedBy', label: t('reports.generatedBy'), value: row => row.uploadedBy?.name, align: 'start', priority: 2, width: 16 },
    { key: 'createdAt', label: t('common.createdAt'), value: row => fmt.date(row.createdAt), align: 'center', priority: 2, width: 14, direction: 'ltr' },
  ];
  return {
    mode: 'REPORT', title: t('reports.attachmentsReport'), paperSize: 'A4', orientation: 'portrait',
    scopeLabel: t('reports.printDocument.attachmentsScope'), filters,
    periodStart: params.dateFrom ? String(params.dateFrom) : undefined,
    periodEnd: params.dateTo ? String(params.dateTo) : undefined,
    summary: (data.cards || []).map(card => ({ label: t(`reports.${card.label}`), value: card.label === 'totalAttachmentsSize' ? size(card.value) : fmt.number(card.value) })),
    sections: [
      { columns, rows: data.rows },
      { title: t('reports.printDocument.attachmentDistribution'), rows: data.byEntityType || [], columns: [
        { key: 'entityName', label: t('reports.byEntity'), value: row => translateEntityType(row.entityName, locale), align: 'start', priority: 1, width: 80 },
        { key: 'count', label: t('reports.total'), value: row => fmt.number(row.count), align: 'end', priority: 2, width: 20, direction: 'ltr' },
      ] },
    ],
    notes: [t('reports.printDocument.attachmentsSecurityNote')],
  };
}
