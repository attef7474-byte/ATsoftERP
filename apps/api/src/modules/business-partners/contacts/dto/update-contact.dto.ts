import { PartialType } from '@nestjs/swagger';
import { CreateBusinessPartnerContactDto } from './create-contact.dto';

export class UpdateBusinessPartnerContactDto extends PartialType(CreateBusinessPartnerContactDto) {}
