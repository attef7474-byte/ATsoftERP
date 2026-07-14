import { Module } from '@nestjs/common';
import { MaintenanceTasksController } from './maintenance-tasks.controller';
import { MaintenanceTasksService } from './maintenance-tasks.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [MaintenanceTasksController],
  providers: [MaintenanceTasksService],
  exports: [MaintenanceTasksService],
})
export class MaintenanceTasksModule {}
