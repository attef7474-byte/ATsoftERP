import { PRINT_ROW_LIMIT, printFormatters, PrintPreparationError, type PrintColumn, type PrintField, type PrintPage } from '../../lib/print';
import { translateAuditAction, translateEntityType, translateStatus } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

interface NamedUser { name?: string }
export interface AuditPrintRow {
  id: string; action: string; entity: string; user?: NamedUser | null; details?: string | null; createdAt?: string | null;
}
export interface AuditPrintData extends PrintPage<AuditPrintRow> {
  cards: Array<{ label: string; value: number }>;
  byAction: Array<{ action: string; count: number }>;
  byEntity: Array<{ entity: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
}

const DETAIL_FIELDS = new Set(['message', 'reason', 'oldStatus', 'newStatus', 'status', 'workPerformed', 'notes', 'title', 'name', 'code', 'passed', 'downtimeHours', 'durationMinutes', 'quantity', 'amount']);
const STATUS_FIELDS = new Set(['oldStatus', 'newStatus', 'status']);
const NUMBER_FIELDS = new Set(['downtimeHours', 'durationMinutes', 'quantity', 'amount']);

function redactTechnicalIds(value: string): string | undefined {
  const cleaned = value
    .replace(/\bcm[a-z0-9]{20,}\b/gi, '…')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '…')
    .trim();
  return cleaned && cleaned !== '…' ? cleaned : undefined;
}

/** Audit details are stored as free text or JSON that can embed tenant, user and record IDs. */
function printableAuditDetails(value: string | null | undefined, t: PrintTranslate, locale: Locale, fmt: ReturnType<typeof printFormatters>): string | undefined {
  if (!value) return undefined;
  const text = String(value);
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const parts: string[] = [];
    for (const [key, raw] of Object.entries(parsed as Record<string, unknown>)) {
      if (!DETAIL_FIELDS.has(key) || raw === null || raw === undefined || typeof raw === 'object') continue;
      if (STATUS_FIELDS.has(key)) { parts.push(translateStatus(String(raw), locale)); continue; }
      if (key === 'passed') { parts.push(raw ? t('common.yes') : t('common.no')); continue; }
      if (NUMBER_FIELDS.has(key) && Number.isFinite(Number(raw))) { parts.push(fmt.number(Number(raw))); continue; }
      const cleaned = redactTechnicalIds(String(raw));
      if (cleaned) parts.push(cleaned);
    }
    return parts.length ? parts.join(' · ') : undefined;
  }
  return redactTechnicalIds(text);
}

/** Audit details are sensitive; only recorded business fields are printed and user IDs stay out. */
export function systemAuditPrintModel(snapshot: ReportPrintSnapshot<AuditPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params } = snapshot, fmt = printFormatters(locale);
  if (!Array.isArray(data.rows) || data.rows.length > PRINT_ROW_LIMIT) throw new PrintPreparationError('limitExceeded');
  const filters: PrintField[] = [];
  if (params.search) filters.push({ label: t('common.search'), value: String(params.search) });
  const columns: PrintColumn<AuditPrintRow>[] = [
    { key: 'action', label: t('reports.auditAction'), value: row => translateAuditAction(row.action, locale), align: 'start', priority: 1, width: 18 },
    { key: 'entity', label: t('reports.byEntity'), value: row => translateEntityType(row.entity, locale), align: 'start', priority: 1, width: 18 },
    { key: 'user', label: t('reports.generatedBy'), value: row => row.user?.name, align: 'start', priority: 1, width: 18 },
    { key: 'details', label: t('common.description'), value: row => printableAuditDetails(row.details, t, locale, fmt), align: 'start', priority: 2, width: 28 },
    { key: 'createdAt', label: t('common.createdAt'), value: row => fmt.dateTime(row.createdAt), align: 'center', priority: 1, width: 18, direction: 'ltr' },
  ];
  const countColumn: PrintColumn<{ count: number }> = { key: 'count', label: t('reports.total'), value: row => fmt.number(row.count), align: 'end', priority: 2, width: 20, direction: 'ltr' };
  return {
    mode: 'REPORT', title: t('reports.auditTrailReport'), paperSize: 'A4', orientation: 'portrait',
    scopeLabel: t('reports.printDocument.auditScope'), filters,
    periodStart: params.dateFrom ? String(params.dateFrom) : undefined,
    periodEnd: params.dateTo ? String(params.dateTo) : undefined,
    summary: (data.cards || []).map(card => ({ label: t(`reports.${card.label}`), value: fmt.number(card.value) })),
    sections: [
      { columns, rows: data.rows },
      { title: t('reports.printDocument.auditDistribution'), rows: data.byAction || [], columns: [
        { key: 'action', label: t('reports.auditAction'), value: row => translateAuditAction(row.action, locale), align: 'start', priority: 1, width: 80 },
        countColumn,
      ] },
      { title: t('reports.byEntity'), rows: data.byEntity || [], columns: [
        { key: 'entity', label: t('reports.byEntity'), value: row => translateEntityType(row.entity, locale), align: 'start', priority: 1, width: 80 },
        countColumn,
      ] },
    ],
    notes: [t('reports.printDocument.auditSecurityNote')],
  };
}
