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
import { AuditModule } from '../audit/audit.module';
import { ProductionAnalyticsModule } from '../factory/production-analytics/production-analytics.module';
import { OperationalReliabilityModule } from '../factory/operational-analytics/reliability/operational-reliability.module';
import { OperationsReportsController } from './operations-reports.controller';
import { OperationsReportsService } from './services/operations-reports.service';

@Module({
  imports: [AuditModule, ProductionAnalyticsModule, OperationalReliabilityModule],
  controllers: [ReportsController, OperationsReportsController],
  providers: [
    ReportsService,
    DashboardReportsService,
    MaintenanceReportsService,
    InventoryReportsService,
    BarcodeReportsService,
    SystemReportsService,
    AuditReportsService,
    ReportExportService,
    OperationsReportsService,
  ],
})
export class ReportsModule {}
