import { PartialType } from '@nestjs/swagger';
import { CreateProductionUnitDto } from './create-production-unit.dto';

export class UpdateProductionUnitDto extends PartialType(CreateProductionUnitDto) {}
