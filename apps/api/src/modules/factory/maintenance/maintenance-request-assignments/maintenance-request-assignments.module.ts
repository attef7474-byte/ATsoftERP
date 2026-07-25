import { Module } from '@nestjs/common';
import { MaintenanceRequestAssignmentsController } from './maintenance-request-assignments.controller';
import { MaintenanceRequestAssignmentsService } from './maintenance-request-assignments.service';

@Module({
  controllers: [MaintenanceRequestAssignmentsController],
  providers: [MaintenanceRequestAssignmentsService],
  exports: [MaintenanceRequestAssignmentsService],
})
export class MaintenanceRequestAssignmentsModule {}
