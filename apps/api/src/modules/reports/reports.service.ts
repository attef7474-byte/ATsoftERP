import { Injectable } from '@nestjs/common';
import { DashboardReportsService } from './services/dashboard-reports.service';
import { MaintenanceReportsService } from './services/maintenance-reports.service';
import { InventoryReportsService } from './services/inventory-reports.service';
import { BarcodeReportsService } from './services/barcode-reports.service';
import { SystemReportsService } from './services/system-reports.service';
import { AuditReportsService } from './services/audit-reports.service';
import { ReportExportService } from './services/report-export.service';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';
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

  getMaintenanceOverview(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    return this.dashboardReportsService.getMaintenanceOverview(filters, ctx);
  }

  getInventoryOverview(filters: InventoryReportFilterDto) {
    return this.dashboardReportsService.getInventoryOverview(filters);
  }

  getMaintenanceRequestsReport(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    return this.maintenanceReportsService.getMaintenanceRequestsReport(filters, ctx);
  }

  getMachineDowntimeReport(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    return this.maintenanceReportsService.getMachineDowntimeReport(filters, ctx);
  }

  getMaintenanceCostsReport(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    return this.maintenanceReportsService.getMaintenanceCostsReport(filters, ctx);
  }

  getPreventiveSchedulesReport(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    return this.maintenanceReportsService.getPreventiveSchedulesReport(filters, ctx);
  }

  getMachineLogReport(filters: any, ctx: ActiveOperationalContext) {
    return this.maintenanceReportsService.getMachineLogReport(filters, ctx);
  }

  getPartsUsageReport(filters: any, ctx: ActiveOperationalContext) {
    return this.maintenanceReportsService.getPartsUsageReport(filters, ctx);
  }

  getUpcomingPreventiveReport(filters: any, ctx: ActiveOperationalContext) {
    return this.maintenanceReportsService.getUpcomingPreventiveReport(filters, ctx);
  }

  getOverduePreventiveReport(filters: any, ctx: ActiveOperationalContext) {
    return this.maintenanceReportsService.getOverduePreventiveReport(filters, ctx);
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

  getStockCard(filters: any) {
    return this.inventoryReportsService.getStockCard(filters);
  }

  getMovementTypes(filters: any) {
    return this.inventoryReportsService.getMovementTypes(filters);
  }

  getByWarehouseSummary(filters: any) {
    return this.inventoryReportsService.getByWarehouseSummary(filters);
  }

  getByLocationSummary(filters: any) {
    return this.inventoryReportsService.getByLocationSummary(filters);
  }

  getByProduct(productId: string, filters: any) {
    return this.inventoryReportsService.getByProduct(productId, filters);
  }

  getBySource(sourceType: string, sourceId: string) {
    return this.inventoryReportsService.getBySource(sourceType, sourceId);
  }

  getMovementTraceability(id: string) {
    return this.inventoryReportsService.getMovementTraceability(id);
  }

  getExceptions(filters: any) {
    return this.inventoryReportsService.getExceptions(filters);
  }

  getTopMovingItems(filters: any) {
    return this.inventoryReportsService.getTopMovingItems(filters);
  }

  getDashboardCards() {
    return this.inventoryReportsService.getDashboardCards();
  }

  getNegativeBalances(filters: any) {
    return this.inventoryReportsService.getNegativeBalances(filters);
  }

  getReconciliationDifferences(filters: any) {
    return this.inventoryReportsService.getReconciliationDifferences(filters);
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

  // ─────────────── AF-AG: Enhanced Cost Analysis ───────────────

  getCostAnalysis(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    return this.maintenanceReportsService.getCostAnalysis(filters, ctx);
  }

  getCostByMachine(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    return this.maintenanceReportsService.getCostByMachine(filters, ctx);
  }

  // ─────────────── AF-AG: Schedule Compliance ───────────────

  getScheduleCompliance(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    return this.maintenanceReportsService.getScheduleCompliance(filters, ctx);
  }

  // ─────────────── AF-AG: KPI Overview ───────────────

  getKpiOverview(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    return this.maintenanceReportsService.getKpiOverview(filters, ctx);
  }

  // ─────────────── AF-AG: Backlog Trend ───────────────

  getBacklogTrend(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    return this.maintenanceReportsService.getBacklogTrend(filters, ctx);
  }

  exportCsv(endpoint: string, filters: any, ctx: ActiveOperationalContext): Promise<string> {
    return this.reportExportService.exportCsv(endpoint, filters, ctx);
  }

  exportExcel(endpoint: string, filters: any, ctx: ActiveOperationalContext): Promise<Buffer | null> {
    return this.reportExportService.exportExcel(endpoint, filters, ctx);
  }
}
