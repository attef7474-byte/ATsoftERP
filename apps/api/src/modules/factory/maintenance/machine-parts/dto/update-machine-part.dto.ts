import { PartialType } from '@nestjs/swagger';
import { CreateMachinePartDto } from './create-machine-part.dto';

export class UpdateMachinePartDto extends PartialType(CreateMachinePartDto) {}
