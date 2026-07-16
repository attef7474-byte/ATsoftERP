import { PartialType } from '@nestjs/swagger';
import { CreateMaintenanceRequestPartDto } from './create-maintenance-request-part.dto';

export class UpdateMaintenanceRequestPartDto extends PartialType(CreateMaintenanceRequestPartDto) {}
