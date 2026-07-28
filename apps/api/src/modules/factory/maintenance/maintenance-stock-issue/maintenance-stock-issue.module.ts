import { Module } from '@nestjs/common';
import { MaintenanceStockIssueController } from './maintenance-stock-issue.controller';
import { MaintenanceStockIssueService } from './maintenance-stock-issue.service';
import { AuditModule } from '../../../../common/audit/audit.module';
import { SparePartConditionModule } from '../spare-part-conditions/spare-part-conditions.module';

@Module({
  imports: [AuditModule, SparePartConditionModule],
  controllers: [MaintenanceStockIssueController],
  providers: [MaintenanceStockIssueService],
  exports: [MaintenanceStockIssueService],
})
export class MaintenanceStockIssueModule {}
