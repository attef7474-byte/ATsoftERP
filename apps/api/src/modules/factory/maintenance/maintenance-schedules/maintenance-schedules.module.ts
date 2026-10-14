import { Module } from '@nestjs/common';
import { MaintenanceSchedulesController } from './maintenance-schedules.controller';
import { MaintenanceSchedulesService } from './maintenance-schedules.service';
import { PreventiveScheduleDuplicateGuard } from './preventive-schedule-duplicate.guard';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [MaintenanceSchedulesController],
  providers: [MaintenanceSchedulesService, PreventiveScheduleDuplicateGuard],
  exports: [MaintenanceSchedulesService],
})
export class MaintenanceSchedulesModule {}
