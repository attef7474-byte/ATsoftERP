import { Controller, Get, Param, Query, Res, UseGuards, Header } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { MaintenanceReportFilterDto, InventoryReportFilterDto, BarcodeReportFilterDto } from './dto/report-filter.dto';
import { CurrentActiveContext } from '../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get('maintenance/overview')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Maintenance overview report' })
  getMaintenanceOverview(@Query() filters: MaintenanceReportFilterDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getMaintenanceOverview(filters, ctx);
  }

  @Get('maintenance/requests')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Maintenance requests report' })
  getMaintenanceRequests(@Query() filters: MaintenanceReportFilterDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getMaintenanceRequestsReport(filters, ctx);
  }

  @Get('maintenance/downtime')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Machine downtime report' })
  getMachineDowntime(@Query() filters: MaintenanceReportFilterDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getMachineDowntimeReport(filters, ctx);
  }

  @Get('maintenance/costs')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Maintenance costs / parts usage report' })
  getMaintenanceCosts(@Query() filters: MaintenanceReportFilterDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getMaintenanceCostsReport(filters, ctx);
  }

  @Get('maintenance/schedules')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Preventive schedule due report' })
  getPreventiveSchedules(@Query() filters: MaintenanceReportFilterDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getPreventiveSchedulesReport(filters, ctx);
  }

  @Get('inventory/overview')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Inventory overview report' })
  getInventoryOverview(@Query() filters: InventoryReportFilterDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getInventoryOverview(filters, ctx);
  }

  @Get('inventory/balances')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Inventory balance report' })
  getInventoryBalances(@Query() filters: InventoryReportFilterDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getInventoryBalanceReport(filters, ctx);
  }

  @Get('inventory/count-variance')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Inventory count variance report' })
  getInventoryCountVariance(@Query() filters: InventoryReportFilterDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getInventoryCountVarianceReport(filters, ctx);
  }

  @Get('inventory/movements')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Inventory movements report' })
  getInventoryMovements(@Query() filters: InventoryReportFilterDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getInventoryMovementsReport(filters, ctx);
  }

  @Get('inventory/adjustments')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Inventory adjustments report' })
  getInventoryAdjustments(@Query() filters: InventoryReportFilterDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getInventoryAdjustmentsReport(filters, ctx);
  }

  @Get('barcodes/scans')
  @Permissions('reports.barcodes:read')
  @ApiOperation({ summary: 'Barcode scan activity report' })
  getBarcodeScans(@Query() filters: BarcodeReportFilterDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getBarcodeScansReport(filters, ctx);
  }

  // ─────────────── NEW BATCH 33 REPORTS ───────────────

  @Get('assets')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Assets register report' })
  getAssetsRegister(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getAssetsRegisterReport(filters, ctx);
  }

  @Get('parts')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Machine parts inventory report' })
  getParts(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getPartsReport(filters, ctx);
  }

  @Get('partners')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Business partners report' })
  getPartners(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getPartnersReport(filters, ctx);
  }

  @Get('attachments')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Attachments / documents report' })
  getAttachments(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getAttachmentsReport(filters, ctx);
  }

  @Get('audit')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Audit trail report' })
  getAuditTrail(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getAuditTrailReport(filters, ctx);
  }

  @Get('user-activity')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'User activity report' })
  getUserActivity(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getUserActivityReport(filters, ctx);
  }

  @Get('notifications')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Notifications report' })
  getNotifications(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getNotificationsReport(filters, ctx);
  }

  // ─────────────── BATCH 33 CORRECTIVE REPORTS ───────────────

  @Get('machine-log')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Machine activity log report' })
  getMachineLog(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getMachineLogReport(filters, ctx);
  }

  @Get('parts-usage')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Parts usage report' })
  getPartsUsage(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getPartsUsageReport(filters, ctx);
  }

  @Get('upcoming-preventive')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Upcoming preventive maintenance report' })
  getUpcomingPreventive(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getUpcomingPreventiveReport(filters, ctx);
  }

  @Get('overdue-preventive')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Overdue preventive maintenance report' })
  getOverduePreventive(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getOverduePreventiveReport(filters, ctx);
  }

  @Get('low-stock')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Low stock products report' })
  getLowStock(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getLowStockReport(filters, ctx);
  }

  // ─────────────── BATCH U — INVENTORY REPORTS + TRACEABILITY ───────────────

  @Get('inventory/stock-card')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Stock card / item ledger with running balance' })
  @ApiQuery({ name: 'productId', required: true, type: String })
  getStockCard(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getStockCard(filters, ctx);
  }

  @Get('inventory/movement-types')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Movement type summary' })
  getMovementTypes(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getMovementTypes(filters, ctx);
  }

  @Get('inventory/by-warehouse')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Warehouse movement summary' })
  getByWarehouseSummary(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getByWarehouseSummary(filters, ctx);
  }

  @Get('inventory/by-location')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Location movement summary' })
  getByLocationSummary(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getByLocationSummary(filters, ctx);
  }

  @Get('inventory/by-product/:productId')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Product movement history' })
  getByProduct(@Param('productId') productId: string, @Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getByProduct(productId, filters, ctx);
  }

  @Get('inventory/by-source/:sourceType/:sourceId')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Source traceability' })
  getBySource(@Param('sourceType') sourceType: string, @Param('sourceId') sourceId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getBySource(sourceType, sourceId, ctx);
  }

  @Get('inventory/traceability/:movementId')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Movement traceability with source document' })
  getMovementTraceability(@Param('movementId') movementId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getMovementTraceability(movementId, ctx);
  }

  @Get('inventory/exceptions')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Exception / integrity report' })
  getExceptions(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getExceptions(filters, ctx);
  }

  @Get('inventory/top-moving-items')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Top moving products' })
  getTopMovingItems(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getTopMovingItems(filters, ctx);
  }

  @Get('inventory/dashboard-cards')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Dashboard cards with real aggregates' })
  getDashboardCards(@CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getDashboardCards(ctx);
  }

  @Get('inventory/negative-balances')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Negative balance report' })
  getNegativeBalances(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getNegativeBalances(filters, ctx);
  }

  @Get('inventory/reconciliation-differences')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Reconciliation difference report' })
  getReconciliationDifferences(@Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getReconciliationDifferences(filters, ctx);
  }

  // ─────────────── AF-AG: Enhanced Cost Analysis ───────────────

  @Get('maintenance/costs/analysis')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Consolidated cost analysis with trends' })
  getCostAnalysis(@Query() filters: MaintenanceReportFilterDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getCostAnalysis(filters, ctx);
  }

  @Get('maintenance/costs/by-machine')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Maintenance cost by machine' })
  getCostByMachine(@Query() filters: MaintenanceReportFilterDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getCostByMachine(filters, ctx);
  }

  // ─────────────── AF-AG: Schedule Compliance ───────────────

  @Get('maintenance/schedule-compliance')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'PM schedule compliance rate' })
  getScheduleCompliance(@Query() filters: MaintenanceReportFilterDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getScheduleCompliance(filters, ctx);
  }

  // ─────────────── AF-AG: KPI Overview ───────────────

  @Get('maintenance/kpi-overview')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Consolidated maintenance KPIs overview' })
  getKpiOverview(@Query() filters: MaintenanceReportFilterDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getKpiOverview(filters, ctx);
  }

  // ─────────────── AF-AG: Backlog Trend ───────────────

  @Get('maintenance/backlog-trend')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Open request backlog by month' })
  getBacklogTrend(@Query() filters: MaintenanceReportFilterDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getBacklogTrend(filters, ctx);
  }

  @Get('export/csv/*endpoint')
  @Permissions('reports.maintenance:read', 'reports.inventory:read', 'reports.barcodes:read')
  @ApiOperation({ summary: 'Export report as CSV' })
  async exportCsv(@Param('endpoint') endpoint: string | string[], @Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext, @Res() res: Response) {
    const normalized = Array.isArray(endpoint) ? endpoint.join('/') : endpoint;
    const csv = await this.service.exportCsv(normalized, filters, ctx);
    if (!csv) {
      res.status(404).json({ message: 'No data to export' });
      return;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${normalized.replace(/\//g, '-')}_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  @Get('export/excel/*endpoint')
  @Permissions('reports.maintenance:read', 'reports.inventory:read', 'reports.barcodes:read')
  @ApiOperation({ summary: 'Export report as Excel (.xlsx)' })
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportExcel(@Param('endpoint') endpoint: string | string[], @Query() filters: any, @CurrentActiveContext() ctx: ActiveOperationalContext, @Res() res: Response) {
    const normalized = Array.isArray(endpoint) ? endpoint.join('/') : endpoint;
    const buffer = await this.service.exportExcel(normalized, filters, ctx);
    if (!buffer) {
      res.status(404).json({ message: 'No data to export' });
      return;
    }
    res.setHeader('Content-Disposition', `attachment; filename="${normalized.replace(/\//g, '-')}_${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(buffer);
  }
}
