import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../common/prisma/prisma.module';
import { MaintenanceReliabilityController } from './maintenance-reliability.controller';
import { MaintenanceReliabilityService } from './maintenance-reliability.service';
import { DowntimeLogsModule } from '../downtime-logs/downtime-logs.module';

@Module({
  imports: [PrismaModule, DowntimeLogsModule],
  controllers: [MaintenanceReliabilityController],
  providers: [MaintenanceReliabilityService],
  exports: [MaintenanceReliabilityService],
})
export class MaintenanceReliabilityModule {}
