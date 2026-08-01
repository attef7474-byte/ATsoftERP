import { Module } from '@nestjs/common';
import { AuditModule } from '../../../../common/audit/audit.module';
import { MaintenanceRequestAssignmentsController } from './maintenance-request-assignments.controller';
import { MaintenanceRequestAssignmentsService } from './maintenance-request-assignments.service';

@Module({
  imports: [AuditModule],
  controllers: [MaintenanceRequestAssignmentsController],
  providers: [MaintenanceRequestAssignmentsService],
  exports: [MaintenanceRequestAssignmentsService],
})
export class MaintenanceRequestAssignmentsModule {}
