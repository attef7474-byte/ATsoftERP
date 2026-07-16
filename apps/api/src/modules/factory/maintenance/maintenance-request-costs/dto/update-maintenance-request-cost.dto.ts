import { PartialType } from '@nestjs/swagger';
import { CreateMaintenanceRequestCostDto } from './create-maintenance-request-cost.dto';

export class UpdateMaintenanceRequestCostDto extends PartialType(CreateMaintenanceRequestCostDto) {}
