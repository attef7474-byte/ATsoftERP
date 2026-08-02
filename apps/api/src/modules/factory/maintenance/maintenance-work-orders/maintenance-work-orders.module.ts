import { Module } from '@nestjs/common';
import { MaintenanceWorkOrdersController } from './maintenance-work-orders.controller';
import { MaintenanceWorkOrdersService } from './maintenance-work-orders.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [MaintenanceWorkOrdersController],
  providers: [MaintenanceWorkOrdersService],
  exports: [MaintenanceWorkOrdersService],
})
export class MaintenanceWorkOrdersModule {}
