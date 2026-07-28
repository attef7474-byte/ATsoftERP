import { Module } from '@nestjs/common';
import { MaintenanceStockIssueController } from './maintenance-stock-issue.controller';
import { MaintenanceStockIssueService } from './maintenance-stock-issue.service';
import { AuditModule } from '../../../../common/audit/audit.module';
import { SparePartConditionModule } from '../spare-part-conditions/spare-part-conditions.module';
import { InstalledPartsReplacementModule } from '../installed-parts-replacement/installed-parts-replacement.module';

@Module({
  imports: [AuditModule, SparePartConditionModule, InstalledPartsReplacementModule],
  controllers: [MaintenanceStockIssueController],
  providers: [MaintenanceStockIssueService],
  exports: [MaintenanceStockIssueService],
})
export class MaintenanceStockIssueModule {}
