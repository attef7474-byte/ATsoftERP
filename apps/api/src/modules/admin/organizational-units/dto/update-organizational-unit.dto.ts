import { PartialType } from '@nestjs/swagger';
import { CreateOrganizationalUnitDto } from './create-organizational-unit.dto';

export class UpdateOrganizationalUnitDto extends PartialType(CreateOrganizationalUnitDto) {}
