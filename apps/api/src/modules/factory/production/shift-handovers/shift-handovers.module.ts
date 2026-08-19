import { Module } from '@nestjs/common';
import { ShiftHandoversController } from './shift-handovers.controller';
import { ShiftHandoversService } from './shift-handovers.service';
import { AuditModule } from '../../../../common/audit/audit.module';
import { NotificationsModule } from '../../../notifications/notifications.module';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [ShiftHandoversController],
  providers: [ShiftHandoversService],
  exports: [ShiftHandoversService],
})
export class ShiftHandoversModule {}
