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

  getInventoryOverview(filters: InventoryReportFilterDto, ctx: ActiveOperationalContext) {
    return this.dashboardReportsService.getInventoryOverview(filters, ctx);
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

  getInventoryBalanceReport(filters: InventoryReportFilterDto, ctx: ActiveOperationalContext) {
    return this.inventoryReportsService.getInventoryBalanceReport(filters, ctx);
  }

  getInventoryCountVarianceReport(filters: InventoryReportFilterDto, ctx: ActiveOperationalContext) {
    return this.inventoryReportsService.getInventoryCountVarianceReport(filters, ctx);
  }

  getInventoryMovementsReport(filters: InventoryReportFilterDto, ctx: ActiveOperationalContext) {
    return this.inventoryReportsService.getInventoryMovementsReport(filters, ctx);
  }

  getInventoryAdjustmentsReport(filters: InventoryReportFilterDto, ctx: ActiveOperationalContext) {
    return this.inventoryReportsService.getInventoryAdjustmentsReport(filters, ctx);
  }

  getBarcodeScansReport(filters: BarcodeReportFilterDto, ctx: ActiveOperationalContext) {
    return this.barcodeReportsService.getBarcodeScansReport(filters, ctx);
  }

  getAssetsRegisterReport(filters: any, ctx: ActiveOperationalContext) {
    return this.systemReportsService.getAssetsRegisterReport(filters, ctx);
  }

  getPartsReport(filters: any, ctx: ActiveOperationalContext) {
    return this.systemReportsService.getPartsReport(filters, ctx);
  }

  getPartnersReport(filters: any, ctx: ActiveOperationalContext) {
    return this.systemReportsService.getPartnersReport(filters, ctx);
  }

  getAttachmentsReport(filters: any, ctx: ActiveOperationalContext) {
    return this.systemReportsService.getAttachmentsReport(filters, ctx);
  }

  getLowStockReport(filters: any, ctx: ActiveOperationalContext) {
    return this.systemReportsService.getLowStockReport(filters, ctx);
  }

  getStockCard(filters: any, ctx: ActiveOperationalContext) {
    return this.inventoryReportsService.getStockCard(filters, ctx);
  }

  getMovementTypes(filters: any, ctx: ActiveOperationalContext) {
    return this.inventoryReportsService.getMovementTypes(filters, ctx);
  }

  getByWarehouseSummary(filters: any, ctx: ActiveOperationalContext) {
    return this.inventoryReportsService.getByWarehouseSummary(filters, ctx);
  }

  getByLocationSummary(filters: any, ctx: ActiveOperationalContext) {
    return this.inventoryReportsService.getByLocationSummary(filters, ctx);
  }

  getByProduct(productId: string, filters: any, ctx: ActiveOperationalContext) {
    return this.inventoryReportsService.getByProduct(productId, filters, ctx);
  }

  getBySource(sourceType: string, sourceId: string, ctx: ActiveOperationalContext) {
    return this.inventoryReportsService.getBySource(sourceType, sourceId, ctx);
  }

  getMovementTraceability(id: string, ctx: ActiveOperationalContext) {
    return this.inventoryReportsService.getMovementTraceability(id, ctx);
  }

  getExceptions(filters: any, ctx: ActiveOperationalContext) {
    return this.inventoryReportsService.getExceptions(filters, ctx);
  }

  getTopMovingItems(filters: any, ctx: ActiveOperationalContext) {
    return this.inventoryReportsService.getTopMovingItems(filters, ctx);
  }

  getDashboardCards(ctx: ActiveOperationalContext) {
    return this.inventoryReportsService.getDashboardCards(ctx);
  }

  getNegativeBalances(filters: any, ctx: ActiveOperationalContext) {
    return this.inventoryReportsService.getNegativeBalances(filters, ctx);
  }

  getReconciliationDifferences(filters: any, ctx: ActiveOperationalContext) {
    return this.inventoryReportsService.getReconciliationDifferences(filters, ctx);
  }

  getAuditTrailReport(filters: any, ctx: ActiveOperationalContext) {
    return this.auditReportsService.getAuditTrailReport(filters, ctx);
  }

  getUserActivityReport(filters: any, ctx: ActiveOperationalContext) {
    return this.auditReportsService.getUserActivityReport(filters, ctx);
  }

  getNotificationsReport(filters: any, ctx: ActiveOperationalContext) {
    return this.auditReportsService.getNotificationsReport(filters, ctx);
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
