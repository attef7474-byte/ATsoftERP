import { PartialType } from '@nestjs/swagger';
import { CreateProductionCapacityStandardDto } from './create-production-capacity-standard.dto';

export class UpdateProductionCapacityStandardDto extends PartialType(CreateProductionCapacityStandardDto) {}
