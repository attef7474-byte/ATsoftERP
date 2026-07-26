import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../common/prisma/prisma.module';
import { MaintenanceDashboardController } from './maintenance-dashboard.controller';
import { MaintenanceDashboardService } from './maintenance-dashboard.service';
import { DowntimeLogsModule } from '../downtime-logs/downtime-logs.module';

@Module({
  imports: [PrismaModule, DowntimeLogsModule],
  controllers: [MaintenanceDashboardController],
  providers: [MaintenanceDashboardService],
  exports: [MaintenanceDashboardService],
})
export class MaintenanceDashboardModule {}
