import { Module } from '@nestjs/common';
import { MaintenanceRequestsController } from './maintenance-requests.controller';
import { MaintenanceRequestsService } from './maintenance-requests.service';
import { AuditModule } from '../../../../common/audit/audit.module';
import { MaintenanceNotificationModule } from '../maintenance-notification/maintenance-notification.module';
import { MaintenanceSlaModule } from '../maintenance-sla/maintenance-sla.module';

@Module({
  imports: [AuditModule, MaintenanceNotificationModule, MaintenanceSlaModule],
  controllers: [MaintenanceRequestsController],
  providers: [MaintenanceRequestsService],
  exports: [MaintenanceRequestsService],
})
export class MaintenanceRequestsModule {}
