import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { DashboardReportsService } from './dashboard-reports.service';
import { MaintenanceReportsService } from './maintenance-reports.service';
import { InventoryReportsService } from './inventory-reports.service';
import { BarcodeReportsService } from './barcode-reports.service';
import { SystemReportsService } from './system-reports.service';
import { AuditReportsService } from './audit-reports.service';

@Injectable()
export class ReportExportService {
  constructor(
    private readonly dashboardReportsService: DashboardReportsService,
    private readonly maintenanceReportsService: MaintenanceReportsService,
    private readonly inventoryReportsService: InventoryReportsService,
    private readonly barcodeReportsService: BarcodeReportsService,
    private readonly systemReportsService: SystemReportsService,
    private readonly auditReportsService: AuditReportsService,
  ) {}

  private async getReportData(endpoint: string, filters: any): Promise<any> {
    switch (endpoint) {
      case 'maintenance/overview': return this.dashboardReportsService.getMaintenanceOverview(filters);
      case 'maintenance/requests': return this.maintenanceReportsService.getMaintenanceRequestsReport(filters);
      case 'maintenance/downtime': return this.maintenanceReportsService.getMachineDowntimeReport(filters);
      case 'maintenance/costs': return this.maintenanceReportsService.getMaintenanceCostsReport(filters);
      case 'maintenance/schedules': return this.maintenanceReportsService.getPreventiveSchedulesReport(filters);
      case 'inventory/overview': return this.dashboardReportsService.getInventoryOverview(filters);
      case 'inventory/balances': return this.inventoryReportsService.getInventoryBalanceReport(filters);
      case 'inventory/count-variance': return this.inventoryReportsService.getInventoryCountVarianceReport(filters);
      case 'inventory/movements': return this.inventoryReportsService.getInventoryMovementsReport(filters);
      case 'inventory/adjustments': return this.inventoryReportsService.getInventoryAdjustmentsReport(filters);
      case 'barcodes/scans': return this.barcodeReportsService.getBarcodeScansReport(filters);
      case 'assets': return this.systemReportsService.getAssetsRegisterReport(filters);
      case 'parts': return this.systemReportsService.getPartsReport(filters);
      case 'partners': return this.systemReportsService.getPartnersReport(filters);
      case 'attachments': return this.systemReportsService.getAttachmentsReport(filters);
      case 'audit': return this.auditReportsService.getAuditTrailReport(filters);
      case 'user-activity': return this.auditReportsService.getUserActivityReport(filters);
      case 'notifications': return this.auditReportsService.getNotificationsReport(filters);
      case 'machine-log': return this.maintenanceReportsService.getMachineLogReport(filters);
      case 'parts-usage': return this.maintenanceReportsService.getPartsUsageReport(filters);
      case 'upcoming-preventive': return this.maintenanceReportsService.getUpcomingPreventiveReport(filters);
      case 'overdue-preventive': return this.maintenanceReportsService.getOverduePreventiveReport(filters);
      case 'low-stock': return this.systemReportsService.getLowStockReport(filters);
      default: return null;
    }
  }

  async exportCsv(endpoint: string, filters: any): Promise<string> {
    const data = await this.getReportData(endpoint, filters);
    if (!data) return '';
    const rows: any[] = data?.rows || [];
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]).filter(k => !k.startsWith('_'));
    const csv = [
      headers.join(','),
      ...rows.map((r: any) => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    return '\uFEFF' + csv;
  }

  async exportExcel(endpoint: string, filters: any): Promise<Buffer | null> {
    const data = await this.getReportData(endpoint, filters);
    if (!data) return null;
    const rows: any[] = data?.rows || [];
    if (!rows.length) return null;
    const headers = Object.keys(rows[0]).filter(k => !k.startsWith('_'));
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Report');
    sheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
    rows.forEach(r => sheet.addRow(Object.fromEntries(headers.map(h => [h, r[h] ?? '']))));
    sheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }
}
