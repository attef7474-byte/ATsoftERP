import { Module } from '@nestjs/common';
import { ProductionShiftsController } from './production-shifts.controller';
import { ProductionShiftsService } from './production-shifts.service';
import { ProductionShiftTemplatesController } from './production-shift-templates.controller';
import { ProductionShiftTemplatesService } from './production-shift-templates.service';
import { ProductionShiftCalendarsController } from './production-shift-calendars.controller';
import { ProductionShiftCalendarsService } from './production-shift-calendars.service';
import { ProductionShiftAssignmentsController } from './production-shift-assignments.controller';
import { ProductionShiftAssignmentsService } from './production-shift-assignments.service';
import { ProductionOperationalAssignmentsController } from './production-operational-assignments.controller';
import { ProductionOperationalAssignmentsService } from './production-operational-assignments.service';
import { ProductionOperationalPeopleController } from './production-operational-people.controller';
import { ProductionOperationalPeopleService } from './production-operational-people.service';
import { AuditModule } from '../../../common/audit/audit.module';
import { NumberingModule } from '../../numbering/numbering.module';

@Module({
  imports: [AuditModule, NumberingModule],
  controllers: [
    ProductionShiftsController,
    ProductionShiftTemplatesController,
    ProductionShiftCalendarsController,
    ProductionShiftAssignmentsController,
    ProductionOperationalAssignmentsController,
    ProductionOperationalPeopleController,
  ],
  providers: [
    ProductionShiftsService,
    ProductionShiftTemplatesService,
    ProductionShiftCalendarsService,
    ProductionShiftAssignmentsService,
    ProductionOperationalAssignmentsService,
    ProductionOperationalPeopleService,
  ],
  exports: [
    ProductionShiftsService,
    ProductionShiftTemplatesService,
    ProductionShiftCalendarsService,
    ProductionShiftAssignmentsService,
    ProductionOperationalAssignmentsService,
    ProductionOperationalPeopleService,
  ],
})
export class ProductionShiftsModule {}
