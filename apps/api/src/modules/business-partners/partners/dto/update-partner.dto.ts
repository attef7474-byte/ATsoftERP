import { PartialType } from '@nestjs/swagger';
import { CreateBusinessPartnerDto } from './create-partner.dto';

export class UpdateBusinessPartnerDto extends PartialType(CreateBusinessPartnerDto) {}
