import { Module } from '@nestjs/common';
import { AuditModule } from '../../../../common/audit/audit.module';
import { MaintenanceReliabilityModule } from '../../maintenance/maintenance-reliability/maintenance-reliability.module';
import { DowntimeLogsModule } from '../../maintenance/downtime-logs/downtime-logs.module';
import { ProductionAnalyticsModule } from '../../production-analytics/production-analytics.module';
import { OperationalReliabilityController } from './operational-reliability.controller';
import { OperationalReliabilityService } from './operational-reliability.service';

@Module({
  imports: [AuditModule, MaintenanceReliabilityModule, DowntimeLogsModule, ProductionAnalyticsModule],
  controllers: [OperationalReliabilityController],
  providers: [OperationalReliabilityService],
  exports: [OperationalReliabilityService],
})
export class OperationalReliabilityModule {}
