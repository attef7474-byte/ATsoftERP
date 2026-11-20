import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../common/prisma/prisma.module';
import { AuditModule } from '../../../../common/audit/audit.module';
import { MaintenanceRequestsModule } from '../maintenance-requests/maintenance-requests.module';
import { MaintenanceReliabilityController } from './maintenance-reliability.controller';
import { ReliabilityAlertsController } from './reliability-alerts.controller';
import { MaintenanceReliabilityService } from './maintenance-reliability.service';
import { InstalledPartReliabilityService } from './installed-part-reliability.service';
import { ReliabilityAlertsService } from './reliability-alerts.service';
import { ReliabilityAlertThresholdsService } from './reliability-alert-thresholds.service';
import { DowntimeLogsModule } from '../downtime-logs/downtime-logs.module';

@Module({
  imports: [PrismaModule, AuditModule, DowntimeLogsModule, MaintenanceRequestsModule],
  controllers: [MaintenanceReliabilityController, ReliabilityAlertsController],
  providers: [MaintenanceReliabilityService, InstalledPartReliabilityService, ReliabilityAlertsService, ReliabilityAlertThresholdsService],
  exports: [MaintenanceReliabilityService, InstalledPartReliabilityService, ReliabilityAlertsService],
})
export class MaintenanceReliabilityModule {}
