import { Module } from '@nestjs/common';
import { MachineResponsibilityAssignmentsController } from './machine-responsibility-assignments.controller';
import { MachineResponsibilityAssignmentsService } from './machine-responsibility-assignments.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [MachineResponsibilityAssignmentsController],
  providers: [MachineResponsibilityAssignmentsService],
  exports: [MachineResponsibilityAssignmentsService],
})
export class MachineResponsibilityAssignmentsModule {}
