import { Module } from '@nestjs/common';
import { PersonAssignmentsController } from './person-assignments.controller';
import { PersonAssignmentsService } from './person-assignments.service';
import { AuditModule } from '../../audit/audit.module';
import { SupervisorAssignmentsModule } from '../supervisor-assignments/supervisor-assignments.module';

@Module({
  imports: [AuditModule, SupervisorAssignmentsModule],
  controllers: [PersonAssignmentsController],
  providers: [PersonAssignmentsService],
  exports: [PersonAssignmentsService],
})
export class PersonAssignmentsModule {}
