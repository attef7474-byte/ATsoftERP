import { Module } from '@nestjs/common';
import { PersonAssignmentsController } from './person-assignments.controller';
import { PersonAssignmentsService } from './person-assignments.service';
import { AuditModule } from '../../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PersonAssignmentsController],
  providers: [PersonAssignmentsService],
  exports: [PersonAssignmentsService],
})
export class PersonAssignmentsModule {}
