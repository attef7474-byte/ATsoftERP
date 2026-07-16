import { Module } from '@nestjs/common';
import { MaintenanceChecklistExecutionsController } from './maintenance-checklist-executions.controller';
import { MaintenanceChecklistExecutionsService } from './maintenance-checklist-executions.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [MaintenanceChecklistExecutionsController],
  providers: [MaintenanceChecklistExecutionsService],
  exports: [MaintenanceChecklistExecutionsService],
})
export class MaintenanceChecklistExecutionsModule {}
