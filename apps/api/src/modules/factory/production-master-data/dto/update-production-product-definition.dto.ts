import { PartialType } from '@nestjs/swagger';
import { CreateProductionProductDefinitionDto } from './create-production-product-definition.dto';

export class UpdateProductionProductDefinitionDto extends PartialType(CreateProductionProductDefinitionDto) {}
