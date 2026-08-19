import { PartialType } from '@nestjs/swagger';
import { CreatePersonAssignmentDto } from './create-person-assignment.dto';

export class UpdatePersonAssignmentDto extends PartialType(CreatePersonAssignmentDto) {}
