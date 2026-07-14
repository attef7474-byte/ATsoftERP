import { PartialType } from '@nestjs/swagger';
import { CreateMachineDocumentDto } from './create-machine-document.dto';

export class UpdateMachineDocumentDto extends PartialType(CreateMachineDocumentDto) {}
