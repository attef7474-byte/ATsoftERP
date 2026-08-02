import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateMaintenanceWorkOrderDto } from './create-maintenance-work-order.dto';

/** Update payload. `parts` are managed through dedicated part endpoints. */
export class UpdateMaintenanceWorkOrderDto extends PartialType(
  OmitType(CreateMaintenanceWorkOrderDto, ['parts'] as const),
) {}
