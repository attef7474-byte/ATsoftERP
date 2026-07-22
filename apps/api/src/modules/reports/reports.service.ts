import { Injectable } from '@nestjs/common';
import { DashboardReportsService } from './services/dashboard-reports.service';
import { MaintenanceReportsService } from './services/maintenance-reports.service';
import { InventoryReportsService } from './services/inventory-reports.service';
import { BarcodeReportsService } from './services/barcode-reports.service';
import { SystemReportsService } from './services/system-reports.service';
import { AuditReportsService } from './services/audit-reports.service';
import { ReportExportService } from './services/report-export.service';
import { MaintenanceReportFilterDto, InventoryReportFilterDto, BarcodeReportFilterDto } from './dto/report-filter.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly dashboardReportsService: DashboardReportsService,
    private readonly maintenanceReportsService: MaintenanceReportsService,
    private readonly inventoryReportsService: InventoryReportsService,
    private readonly barcodeReportsService: BarcodeReportsService,
    private readonly systemReportsService: SystemReportsService,
    private readonly auditReportsService: AuditReportsService,
    private readonly reportExportService: ReportExportService,
  ) {}

  getMaintenanceOverview(filters: MaintenanceReportFilterDto) {
    return this.dashboardReportsService.getMaintenanceOverview(filters);
  }

  getInventoryOverview(filters: InventoryReportFilterDto) {
    return this.dashboardReportsService.getInventoryOverview(filters);
  }

  getMaintenanceRequestsReport(filters: MaintenanceReportFilterDto) {
    return this.maintenanceReportsService.getMaintenanceRequestsReport(filters);
  }

  getMachineDowntimeReport(filters: MaintenanceReportFilterDto) {
    return this.maintenanceReportsService.getMachineDowntimeReport(filters);
  }

  getMaintenanceCostsReport(filters: MaintenanceReportFilterDto) {
    return this.maintenanceReportsService.getMaintenanceCostsReport(filters);
  }

  getPreventiveSchedulesReport(filters: MaintenanceReportFilterDto) {
    return this.maintenanceReportsService.getPreventiveSchedulesReport(filters);
  }

  getMachineLogReport(filters: any) {
    return this.maintenanceReportsService.getMachineLogReport(filters);
  }

  getPartsUsageReport(filters: any) {
    return this.maintenanceReportsService.getPartsUsageReport(filters);
  }

  getUpcomingPreventiveReport(filters: any) {
    return this.maintenanceReportsService.getUpcomingPreventiveReport(filters);
  }

  getOverduePreventiveReport(filters: any) {
    return this.maintenanceReportsService.getOverduePreventiveReport(filters);
  }

  getInventoryBalanceReport(filters: InventoryReportFilterDto) {
    return this.inventoryReportsService.getInventoryBalanceReport(filters);
  }

  getInventoryCountVarianceReport(filters: InventoryReportFilterDto) {
    return this.inventoryReportsService.getInventoryCountVarianceReport(filters);
  }

  getInventoryMovementsReport(filters: InventoryReportFilterDto) {
    return this.inventoryReportsService.getInventoryMovementsReport(filters);
  }

  getInventoryAdjustmentsReport(filters: InventoryReportFilterDto) {
    return this.inventoryReportsService.getInventoryAdjustmentsReport(filters);
  }

  getBarcodeScansReport(filters: BarcodeReportFilterDto) {
    return this.barcodeReportsService.getBarcodeScansReport(filters);
  }

  getAssetsRegisterReport(filters: any) {
    return this.systemReportsService.getAssetsRegisterReport(filters);
  }

  getPartsReport(filters: any) {
    return this.systemReportsService.getPartsReport(filters);
  }

  getPartnersReport(filters: any) {
    return this.systemReportsService.getPartnersReport(filters);
  }

  getAttachmentsReport(filters: any) {
    return this.systemReportsService.getAttachmentsReport(filters);
  }

  getLowStockReport(filters: any) {
    return this.systemReportsService.getLowStockReport(filters);
  }

  getAuditTrailReport(filters: any) {
    return this.auditReportsService.getAuditTrailReport(filters);
  }

  getUserActivityReport(filters: any) {
    return this.auditReportsService.getUserActivityReport(filters);
  }

  getNotificationsReport(filters: any) {
    return this.auditReportsService.getNotificationsReport(filters);
  }

  exportCsv(endpoint: string, filters: any): Promise<string> {
    return this.reportExportService.exportCsv(endpoint, filters);
  }

  exportExcel(endpoint: string, filters: any): Promise<Buffer | null> {
    return this.reportExportService.exportExcel(endpoint, filters);
  }
}
