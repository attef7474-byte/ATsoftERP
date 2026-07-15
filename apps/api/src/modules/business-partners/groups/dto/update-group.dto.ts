import { PartialType } from '@nestjs/swagger';
import { CreateBusinessPartnerGroupDto } from './create-group.dto';

export class UpdateBusinessPartnerGroupDto extends PartialType(CreateBusinessPartnerGroupDto) {}
