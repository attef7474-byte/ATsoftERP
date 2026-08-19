import { PartialType } from '@nestjs/swagger';
import { CreateSupervisorAssignmentDto } from './create-supervisor-assignment.dto';

export class UpdateSupervisorAssignmentDto extends PartialType(CreateSupervisorAssignmentDto) {}
