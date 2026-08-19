import { Module } from '@nestjs/common';
import { SupervisorAssignmentsController } from './supervisor-assignments.controller';
import { SupervisorAssignmentsService } from './supervisor-assignments.service';
import { AuditModule } from '../../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [SupervisorAssignmentsController],
  providers: [SupervisorAssignmentsService],
  exports: [SupervisorAssignmentsService],
})
export class SupervisorAssignmentsModule {}
