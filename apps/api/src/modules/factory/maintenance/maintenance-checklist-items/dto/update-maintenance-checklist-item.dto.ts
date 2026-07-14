import { PartialType } from '@nestjs/swagger';
import { CreateMaintenanceChecklistItemDto } from './create-maintenance-checklist-item.dto';

export class UpdateMaintenanceChecklistItemDto extends PartialType(CreateMaintenanceChecklistItemDto) {}
