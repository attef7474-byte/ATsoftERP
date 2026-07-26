import { Module } from '@nestjs/common';
import { NotificationsModule } from '../../../notifications/notifications.module';
import { MaintenanceNotificationService } from './maintenance-notification.service';

@Module({
  imports: [NotificationsModule],
  providers: [MaintenanceNotificationService],
  exports: [MaintenanceNotificationService],
})
export class MaintenanceNotificationModule {}
