import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { MaintenanceReportFilterDto, InventoryReportFilterDto, BarcodeReportFilterDto } from './dto/report-filter.dto';
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
  getMaintenanceOverview(@Query() filters: MaintenanceReportFilterDto) {
    return this.service.getMaintenanceOverview(filters);
  }

  @Get('maintenance/requests')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Maintenance requests report' })
  getMaintenanceRequests(@Query() filters: MaintenanceReportFilterDto) {
    return this.service.getMaintenanceRequestsReport(filters);
  }

  @Get('maintenance/downtime')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Machine downtime report' })
  getMachineDowntime(@Query() filters: MaintenanceReportFilterDto) {
    return this.service.getMachineDowntimeReport(filters);
  }

  @Get('maintenance/costs')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Maintenance costs / parts usage report' })
  getMaintenanceCosts(@Query() filters: MaintenanceReportFilterDto) {
    return this.service.getMaintenanceCostsReport(filters);
  }

  @Get('maintenance/schedules')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Preventive schedule due report' })
  getPreventiveSchedules(@Query() filters: MaintenanceReportFilterDto) {
    return this.service.getPreventiveSchedulesReport(filters);
  }

  @Get('inventory/overview')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Inventory overview report' })
  getInventoryOverview(@Query() filters: InventoryReportFilterDto) {
    return this.service.getInventoryOverview(filters);
  }

  @Get('inventory/balances')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Inventory balance report' })
  getInventoryBalances(@Query() filters: InventoryReportFilterDto) {
    return this.service.getInventoryBalanceReport(filters);
  }

  @Get('inventory/count-variance')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Inventory count variance report' })
  getInventoryCountVariance(@Query() filters: InventoryReportFilterDto) {
    return this.service.getInventoryCountVarianceReport(filters);
  }

  @Get('inventory/movements')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Inventory movements report' })
  getInventoryMovements(@Query() filters: InventoryReportFilterDto) {
    return this.service.getInventoryMovementsReport(filters);
  }

  @Get('inventory/adjustments')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Inventory adjustments report' })
  getInventoryAdjustments(@Query() filters: InventoryReportFilterDto) {
    return this.service.getInventoryAdjustmentsReport(filters);
  }

  @Get('barcodes/scans')
  @Permissions('reports.barcodes:read')
  @ApiOperation({ summary: 'Barcode scan activity report' })
  getBarcodeScans(@Query() filters: BarcodeReportFilterDto) {
    return this.service.getBarcodeScansReport(filters);
  }

  // ─────────────── NEW BATCH 33 REPORTS ───────────────

  @Get('assets')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Assets register report' })
  getAssetsRegister(@Query() filters: any) {
    return this.service.getAssetsRegisterReport(filters);
  }

  @Get('parts')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Machine parts inventory report' })
  getParts(@Query() filters: any) {
    return this.service.getPartsReport(filters);
  }

  @Get('partners')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Business partners report' })
  getPartners(@Query() filters: any) {
    return this.service.getPartnersReport(filters);
  }

  @Get('attachments')
  @Permissions('reports.maintenance:read')
  @ApiOperation({ summary: 'Attachments / documents report' })
  getAttachments(@Query() filters: any) {
    return this.service.getAttachmentsReport(filters);
  }

  @Get('audit')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Audit trail report' })
  getAuditTrail(@Query() filters: any) {
    return this.service.getAuditTrailReport(filters);
  }

  @Get('user-activity')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'User activity report' })
  getUserActivity(@Query() filters: any) {
    return this.service.getUserActivityReport(filters);
  }

  @Get('notifications')
  @Permissions('reports.inventory:read')
  @ApiOperation({ summary: 'Notifications report' })
  getNotifications(@Query() filters: any) {
    return this.service.getNotificationsReport(filters);
  }

  @Get('export/csv/:endpoint(*)')
  @Permissions('reports.maintenance:read', 'reports.inventory:read', 'reports.barcodes:read')
  @ApiOperation({ summary: 'Export report as CSV' })
  async exportCsv(@Param('endpoint') endpoint: string, @Query() filters: any, @Res() res: Response) {
    const csv = await this.service.exportCsv(endpoint, filters);
    if (!csv) {
      res.status(404).json({ message: 'No data to export' });
      return;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${endpoint.replace(/\//g, '-')}_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }
}
