import { Module } from '@nestjs/common';
import { MaintenanceSchedulesController } from './maintenance-schedules.controller';
import { MaintenanceSchedulesService } from './maintenance-schedules.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [MaintenanceSchedulesController],
  providers: [MaintenanceSchedulesService],
  exports: [MaintenanceSchedulesService],
})
export class MaintenanceSchedulesModule {}
