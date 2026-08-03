import { PartialType } from '@nestjs/swagger';
import { CreateProductionShiftDto } from './create-production-shift.dto';

export class UpdateProductionShiftDto extends PartialType(CreateProductionShiftDto) {}
