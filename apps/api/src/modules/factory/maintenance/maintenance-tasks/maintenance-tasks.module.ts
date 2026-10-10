import { DowntimeLogsModule } from '../downtime-logs/downtime-logs.module';
import { MaintenanceStockIssueModule } from '../maintenance-stock-issue/maintenance-stock-issue.module';
import { MaintenanceWorkOrdersModule } from '../maintenance-work-orders/maintenance-work-orders.module';
import { MaintenanceRequestsModule } from '../maintenance-requests/maintenance-requests.module';
import { Module } from '@nestjs/common';
import { MaintenanceTasksController } from './maintenance-tasks.controller';
import { MaintenanceTasksService } from './maintenance-tasks.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule, MaintenanceRequestsModule, MaintenanceWorkOrdersModule, MaintenanceStockIssueModule, DowntimeLogsModule],
  controllers: [MaintenanceTasksController],
  providers: [MaintenanceTasksService],
  exports: [MaintenanceTasksService],
})
export class MaintenanceTasksModule {}
