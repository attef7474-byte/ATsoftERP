import { PartialType } from '@nestjs/swagger';
import { CreateProductionLineDto } from './create-production-line.dto';

export class UpdateProductionLineDto extends PartialType(CreateProductionLineDto) {}
