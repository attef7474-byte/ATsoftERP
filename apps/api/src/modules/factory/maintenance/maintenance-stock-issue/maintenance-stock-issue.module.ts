import { Module } from '@nestjs/common';
import { MaintenanceStockIssueController } from './maintenance-stock-issue.controller';
import { MaintenanceStockIssueService } from './maintenance-stock-issue.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [MaintenanceStockIssueController],
  providers: [MaintenanceStockIssueService],
  exports: [MaintenanceStockIssueService],
})
export class MaintenanceStockIssueModule {}
