import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { DashboardReportsService } from './services/dashboard-reports.service';
import { MaintenanceReportsService } from './services/maintenance-reports.service';
import { InventoryReportsService } from './services/inventory-reports.service';
import { BarcodeReportsService } from './services/barcode-reports.service';
import { SystemReportsService } from './services/system-reports.service';
import { AuditReportsService } from './services/audit-reports.service';
import { ReportExportService } from './services/report-export.service';

@Module({
  controllers: [ReportsController],
  providers: [
    ReportsService,
    DashboardReportsService,
    MaintenanceReportsService,
    InventoryReportsService,
    BarcodeReportsService,
    SystemReportsService,
    AuditReportsService,
    ReportExportService,
  ],
})
export class ReportsModule {}
