import { PartialType } from '@nestjs/swagger';
import { CreateMaintenanceTaskDto } from './create-maintenance-task.dto';

export class UpdateMaintenanceTaskDto extends PartialType(CreateMaintenanceTaskDto) {}
