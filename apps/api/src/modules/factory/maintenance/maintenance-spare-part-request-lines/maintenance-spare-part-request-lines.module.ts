import { Module } from '@nestjs/common';
import { MaintenanceSparePartRequestLinesController } from './maintenance-spare-part-request-lines.controller';
import { MaintenanceSparePartRequestLinesService } from './maintenance-spare-part-request-lines.service';
import { AuditModule } from '../../../../common/audit/audit.module';
import { MaintenanceNotificationModule } from '../maintenance-notification/maintenance-notification.module';

@Module({
  imports: [AuditModule, MaintenanceNotificationModule],
  controllers: [MaintenanceSparePartRequestLinesController],
  providers: [MaintenanceSparePartRequestLinesService],
  exports: [MaintenanceSparePartRequestLinesService],
})
export class MaintenanceSparePartRequestLinesModule {}
