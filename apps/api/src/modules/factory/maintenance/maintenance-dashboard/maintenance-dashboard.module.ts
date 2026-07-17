import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../common/prisma/prisma.module';
import { MaintenanceDashboardController } from './maintenance-dashboard.controller';
import { MaintenanceDashboardService } from './maintenance-dashboard.service';

@Module({
  imports: [PrismaModule],
  controllers: [MaintenanceDashboardController],
  providers: [MaintenanceDashboardService],
  exports: [MaintenanceDashboardService],
})
export class MaintenanceDashboardModule {}
