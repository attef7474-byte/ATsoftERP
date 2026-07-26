import { Module } from '@nestjs/common';
import { MaintenanceReliabilityController } from './maintenance-reliability.controller';
import { MaintenanceReliabilityService } from './maintenance-reliability.service';
import { DowntimeLogsModule } from '../downtime-logs/downtime-logs.module';

@Module({
  imports: [DowntimeLogsModule],
  controllers: [MaintenanceReliabilityController],
  providers: [MaintenanceReliabilityService],
  exports: [MaintenanceReliabilityService],
})
export class MaintenanceReliabilityModule {}
