import { Module } from '@nestjs/common';
import { MaintenanceRequestsController } from './maintenance-requests.controller';
import { MaintenanceRequestsService } from './maintenance-requests.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [MaintenanceRequestsController],
  providers: [MaintenanceRequestsService],
  exports: [MaintenanceRequestsService],
})
export class MaintenanceRequestsModule {}
