import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../../common/prisma/prisma.module';
import { MaintenanceCalendarWorkloadController } from './maintenance-calendar-workload.controller';
import { MaintenanceCalendarWorkloadService } from './maintenance-calendar-workload.service';

@Module({
  imports: [PrismaModule],
  controllers: [MaintenanceCalendarWorkloadController],
  providers: [MaintenanceCalendarWorkloadService],
  exports: [MaintenanceCalendarWorkloadService],
})
export class MaintenanceCalendarWorkloadModule {}
