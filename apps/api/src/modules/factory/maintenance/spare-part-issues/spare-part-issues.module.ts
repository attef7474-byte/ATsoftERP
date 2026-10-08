import { Module } from '@nestjs/common';
import { SparePartIssuesController } from './spare-part-issues.controller';
import { SparePartIssuesService } from './spare-part-issues.service';
import { MaintenanceStockIssueModule } from '../maintenance-stock-issue/maintenance-stock-issue.module';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [MaintenanceStockIssueModule, AuditModule],
  controllers: [SparePartIssuesController],
  providers: [SparePartIssuesService],
  exports: [SparePartIssuesService],
})
export class SparePartIssuesModule {}
