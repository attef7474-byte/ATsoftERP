import { Module } from '@nestjs/common';
import { MachineResponsibilityAssignmentsController } from './machine-responsibility-assignments.controller';
import { MachineResponsibilityAssignmentsService } from './machine-responsibility-assignments.service';

@Module({
  controllers: [MachineResponsibilityAssignmentsController],
  providers: [MachineResponsibilityAssignmentsService],
  exports: [MachineResponsibilityAssignmentsService],
})
export class MachineResponsibilityAssignmentsModule {}
