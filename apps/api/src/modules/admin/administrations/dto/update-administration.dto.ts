import { PartialType } from '@nestjs/swagger';
import { CreateAdministrationDto } from './create-administration.dto';

export class UpdateAdministrationDto extends PartialType(CreateAdministrationDto) {}
