import { PartialType } from '@nestjs/swagger';
import { CreateMachineCategoryDto } from './create-machine-category.dto';

export class UpdateMachineCategoryDto extends PartialType(CreateMachineCategoryDto) {}
