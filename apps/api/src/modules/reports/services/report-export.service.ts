import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { DashboardReportsService } from './dashboard-reports.service';
import { MaintenanceReportsService } from './maintenance-reports.service';
import { InventoryReportsService } from './inventory-reports.service';
import { BarcodeReportsService } from './barcode-reports.service';
import { SystemReportsService } from './system-reports.service';
import { AuditReportsService } from './audit-reports.service';
import { OperationsReportsService } from './operations-reports.service';
import { ProductionAnalyticsService } from '../../factory/production-analytics/production-analytics.service';
import { AuditService } from '../../../modules/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

/** Maximum number of data rows written to any CSV/XLSX export. */
export const EXPORT_ROW_LIMIT = 5000;
/** Fetch one extra row so truncation can be detected without a second query. */
const EXPORT_FETCH_SIZE = EXPORT_ROW_LIMIT + 1;
const EXPORT_AUDIT_ACTION = 'EXPORT';
const EXPORT_AUDIT_ENTITY = 'report';
const INTERNAL_KEY_PREFIX = '_';
const DATA_SHEET_NAME = 'Report';
const SUMMARY_SHEET_NAME = 'Summary';
/** Never accepted from a client; tenant scope comes from the active context. */
const TENANT_FILTER_KEYS = ['companyId', 'branchId'];

export type ExportFilters = Record<string, any>;

interface ExportColumn {
  key: string;
  header: string;
}

interface ExportTable {
  rows: Record<string, any>[];
  columns: ExportColumn[];
  sheetName: string;
}

interface CappedRows {
  rows: Record<string, any>[];
  truncated: boolean;
}

@Injectable()
export class ReportExportService {
  constructor(
    private readonly dashboardReportsService: DashboardReportsService,
    private readonly maintenanceReportsService: MaintenanceReportsService,
    private readonly inventoryReportsService: InventoryReportsService,
    private readonly barcodeReportsService: BarcodeReportsService,
    private readonly systemReportsService: SystemReportsService,
    private readonly auditReportsService: AuditReportsService,
    private readonly operationsReportsService: OperationsReportsService,
    private readonly productionAnalyticsService: ProductionAnalyticsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Resolves every canonical report endpoint to an existing report-service
   * method. No data is synthesised here; unknown endpoints resolve to null and
   * produce the controller's existing 404 response.
   */
  private async getReportData(endpoint: string, filters: ExportFilters, ctx: ActiveOperationalContext): Promise<any> {
    switch (endpoint) {
      // ── Maintenance (11) ──────────────────────────────────────────────────
      case 'maintenance/overview':
        return this.dashboardReportsService.getMaintenanceOverview(filters, ctx);
      case 'maintenance/requests':
        return this.maintenanceReportsService.getMaintenanceRequestsReport(filters, ctx);
      case 'maintenance/downtime':
        return this.maintenanceReportsService.getMachineDowntimeReport(filters, ctx);
      case 'maintenance/costs':
        return this.maintenanceReportsService.getMaintenanceCostsReport(filters, ctx);
      case 'maintenance/costs/canonical':
        return this.maintenanceReportsService.maintenanceCanonicalCosts(filters, ctx);
      case 'maintenance/schedules':
        return this.maintenanceReportsService.getPreventiveSchedulesReport(filters, ctx);
      case 'maintenance/costs/analysis':
        return this.maintenanceReportsService.getCostAnalysis(filters, ctx);
      case 'maintenance/costs/by-machine':
        return this.maintenanceReportsService.getCostByMachine(filters, ctx);
      case 'maintenance/schedule-compliance':
        return this.maintenanceReportsService.getScheduleCompliance(filters, ctx);
      case 'maintenance/kpi-overview':
        return this.maintenanceReportsService.getKpiOverview(filters, ctx);
      case 'maintenance/backlog-trend':
        return this.maintenanceReportsService.getBacklogTrend(filters, ctx);
      case 'operations/overview':
        return this.operationsReportsService.overview(filters as any, ctx);
      case 'production/analytics':
        return this.productionAnalyticsService.oee(filters as any, ctx);

      // ── Inventory overview + core (5) ────────────────────────────────────
      case 'inventory/overview':
        return this.dashboardReportsService.getInventoryOverview(filters, ctx);
      case 'inventory/balances':
        return this.inventoryReportsService.getInventoryBalanceReport(filters, ctx);
      case 'inventory/count-variance':
        return this.inventoryReportsService.getInventoryCountVarianceReport(filters, ctx);
      case 'inventory/movements':
        return this.inventoryReportsService.getInventoryMovementsReport(filters, ctx);
      case 'inventory/adjustments':
        return this.inventoryReportsService.getInventoryAdjustmentsReport(filters, ctx);

      // ── Inventory traceability batch — static paths (9) ──────────────────
      case 'inventory/stock-card':
        return this.inventoryReportsService.getStockCard(filters, ctx);
      case 'inventory/movement-types':
        return this.inventoryReportsService.getMovementTypes(filters, ctx);
      case 'inventory/by-warehouse':
        return this.inventoryReportsService.getByWarehouseSummary(filters, ctx);
      case 'inventory/by-location':
        return this.inventoryReportsService.getByLocationSummary(filters, ctx);
      case 'inventory/exceptions':
        return this.inventoryReportsService.getExceptions(filters, ctx);
      case 'inventory/top-moving-items':
        return this.inventoryReportsService.getTopMovingItems(filters, ctx);
      case 'inventory/dashboard-cards':
        return this.inventoryReportsService.getDashboardCards(ctx);
      case 'inventory/negative-balances':
        return this.inventoryReportsService.getNegativeBalances(filters, ctx);
      case 'inventory/reconciliation-differences':
        return this.inventoryReportsService.getReconciliationDifferences(filters, ctx);

      // ── Barcode (1) ───────────────────────────────────────────────────────
      case 'barcodes/scans':
        return this.barcodeReportsService.getBarcodeScansReport(filters, ctx);

      // ── Assets / system / audit batch (7) ────────────────────────────────
      case 'assets':
        return this.systemReportsService.getAssetsRegisterReport(filters, ctx);
      case 'parts':
        return this.systemReportsService.getPartsReport(filters, ctx);
      case 'partners':
        return this.systemReportsService.getPartnersReport(filters, ctx);
      case 'attachments':
        return this.systemReportsService.getAttachmentsReport(filters, ctx);
      case 'audit':
        return this.auditReportsService.getAuditTrailReport(filters, ctx);
      case 'user-activity':
        return this.auditReportsService.getUserActivityReport(filters, ctx);
      case 'notifications':
        return this.auditReportsService.getNotificationsReport(filters, ctx);

      // ── Corrective reports (5) ────────────────────────────────────────────
      case 'machine-log':
        return this.maintenanceReportsService.getMachineLogReport(filters, ctx);
      case 'parts-usage':
        return this.maintenanceReportsService.getPartsUsageReport(filters, ctx);
      case 'upcoming-preventive':
        return this.maintenanceReportsService.getUpcomingPreventiveReport(filters, ctx);
      case 'overdue-preventive':
        return this.maintenanceReportsService.getOverduePreventiveReport(filters, ctx);
      case 'low-stock':
        return this.systemReportsService.getLowStockReport(filters, ctx);

      default:
        break;
    }

    // ── Inventory traceability batch — parameterised paths (3) ────────────
    const byProductPrefix = 'inventory/by-product/';
    if (endpoint.startsWith(byProductPrefix)) {
      const productId = endpoint.slice(byProductPrefix.length);
      if (productId) return this.inventoryReportsService.getByProduct(productId, filters, ctx);
    }
    const bySourcePrefix = 'inventory/by-source/';
    if (endpoint.startsWith(bySourcePrefix)) {
      const segments = endpoint.slice(bySourcePrefix.length).split('/');
      if (segments.length >= 2 && segments[0] && segments[1]) {
        return this.inventoryReportsService.getBySource(segments[0], segments[1], ctx);
      }
    }
    const traceabilityPrefix = 'inventory/traceability/';
    if (endpoint.startsWith(traceabilityPrefix)) {
      const movementId = endpoint.slice(traceabilityPrefix.length);
      if (movementId) return this.inventoryReportsService.getMovementTraceability(movementId, ctx);
    }

    return null;
  }

  private normalizeEndpoint(endpoint: string | string[]): string {
    const raw = Array.isArray(endpoint) ? endpoint.join('/') : (endpoint || '');
    return raw.replace(/^\/+|\/+$/g, '').trim();
  }

  /**
   * Tenant scope is never taken from the query string. Drop client-supplied
   * tenant keys and force a full-dataset page so exports are not silently
   * limited to the UI's default page size.
   */
  private sanitizeFilters(filters: ExportFilters): ExportFilters {
    const clean: ExportFilters = {};
    for (const [key, value] of Object.entries(filters || {})) {
      if (TENANT_FILTER_KEYS.includes(key)) continue;
      if (value === undefined) continue;
      clean[key] = value;
    }
    clean.page = 1;
    clean.pageSize = EXPORT_FETCH_SIZE;
    return clean;
  }

  private humanizeHeader(key: string): string {
    return String(key)
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }

  private display(value: any): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  /**
   * Neutralises spreadsheet formula injection and control characters. A value
   * beginning with = + - @ (including after leading whitespace) is prefixed
   * with an apostrophe; tabs and CR/LF are replaced with spaces so a cell can
   * never inject a new line or column.
   */
  private sanitizeCell(value: any): string {
    let text = this.display(value).replace(/[\t\r\n]/g, ' ');
    if (/^\s*[=+\-@]/.test(text)) {
      text = `'${text}`;
    }
    return text;
  }

  private csvCell(value: any): string {
    return `"${this.sanitizeCell(value).replace(/"/g, '""')}"`;
  }

  private columnsFromRows(rows: Record<string, any>[]): ExportColumn[] {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row || {})) {
        if (key.startsWith(INTERNAL_KEY_PREFIX) || seen.has(key)) continue;
        seen.add(key);
        keys.push(key);
      }
    }
    return keys.map((key) => ({ key, header: this.humanizeHeader(key) }));
  }

  /** Flattens a summary-shaped report (cards / scalars / nested arrays) into rows. */
  private buildSummaryRows(data: any): Record<string, any>[] {
    if (!data || typeof data !== 'object') return [];
    const rows: Record<string, any>[] = [];

    if (Array.isArray(data.cards)) {
      for (const card of data.cards) {
        if (!card || typeof card !== 'object') continue;
        const value = card.unit ? `${this.display(card.value)} ${card.unit}` : this.display(card.value);
        rows.push({ Section: 'KPI', Field: this.display(card.label), Value: value });
      }
    }

    for (const [key, value] of Object.entries(data)) {
      if (key === 'cards' || key === 'rows' || key.startsWith(INTERNAL_KEY_PREFIX)) continue;
      if (value === null || value === undefined) continue;
      const section = this.humanizeHeader(key);

      if (Array.isArray(value)) {
        if (!value.length) continue;
        value.forEach((item, index) => {
          rows.push({ Section: section, Field: String(index + 1), Value: this.display(item) });
        });
      } else if (typeof value === 'object') {
        for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, any>)) {
          if (nestedValue === null || nestedValue === undefined) continue;
          rows.push({ Section: section, Field: this.humanizeHeader(nestedKey), Value: this.display(nestedValue) });
        }
      } else {
        rows.push({ Section: 'Summary', Field: section, Value: this.display(value) });
      }
    }
    return rows;
  }

  private toExportTable(data: any): ExportTable {
    if (Array.isArray(data?.rows) && data.rows.length > 0) {
      return {
        rows: data.rows,
        columns: this.columnsFromRows(data.rows),
        sheetName: DATA_SHEET_NAME,
      };
    }
    const summaryRows = this.buildSummaryRows(data);
    if (summaryRows.length > 0) {
      return {
        rows: summaryRows,
        columns: [
          { key: 'Section', header: 'Section' },
          { key: 'Field', header: 'Field' },
          { key: 'Value', header: 'Value' },
        ],
        sheetName: SUMMARY_SHEET_NAME,
      };
    }
    return { rows: [], columns: [], sheetName: SUMMARY_SHEET_NAME };
  }

  private capRows(rows: Record<string, any>[]): CappedRows {
    if (rows.length > EXPORT_ROW_LIMIT) {
      return { rows: rows.slice(0, EXPORT_ROW_LIMIT), truncated: true };
    }
    return { rows, truncated: false };
  }

  private async auditExport(
    format: 'csv' | 'xlsx',
    endpoint: string,
    ctx: ActiveOperationalContext,
    actorId: string | undefined,
    rowCount: number,
    truncated: boolean,
  ): Promise<void> {
    await this.auditService.log({
      userId: actorId,
      action: EXPORT_AUDIT_ACTION,
      entity: EXPORT_AUDIT_ENTITY,
      entityId: endpoint,
      details: JSON.stringify({
        endpoint,
        actor: actorId ?? null,
        companyId: ctx?.companyId ?? null,
        branchId: ctx?.branchId ?? null,
        format,
        rowCount,
        truncated,
      }),
    });
  }

  async exportCsv(
    endpoint: string,
    filters: ExportFilters,
    ctx: ActiveOperationalContext,
    actorId?: string,
  ): Promise<string> {
    const normalized = this.normalizeEndpoint(endpoint);
    const data = await this.getReportData(normalized, this.sanitizeFilters(filters), ctx);
    if (data === null || data === undefined) return '';

    const table = this.toExportTable(data);
    const capped = this.capRows(table.rows);
    if (!capped.rows.length) return '';

    const lines: string[] = [table.columns.map((column) => this.csvCell(column.header)).join(',')];
    for (const row of capped.rows) {
      lines.push(table.columns.map((column) => this.csvCell(row?.[column.key])).join(','));
    }
    await this.auditExport('csv', normalized, ctx, actorId, capped.rows.length, capped.truncated);
    return '\uFEFF' + lines.join('\n');
  }

  async exportExcel(
    endpoint: string,
    filters: ExportFilters,
    ctx: ActiveOperationalContext,
    actorId?: string,
  ): Promise<Buffer | null> {
    const normalized = this.normalizeEndpoint(endpoint);
    const data = await this.getReportData(normalized, this.sanitizeFilters(filters), ctx);
    if (data === null || data === undefined) return null;

    const table = this.toExportTable(data);
    const capped = this.capRows(table.rows);
    if (!capped.rows.length) return null;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(table.sheetName);
    sheet.columns = table.columns.map((column) => ({ header: column.header, key: column.key, width: 24 }));
    for (const row of capped.rows) {
      sheet.addRow(Object.fromEntries(table.columns.map((column) => [column.key, this.sanitizeCell(row?.[column.key])])));
    }
    sheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    await this.auditExport('xlsx', normalized, ctx, actorId, capped.rows.length, capped.truncated);
    return Buffer.from(buffer as ArrayBuffer);
  }
}
