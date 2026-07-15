import { PartialType } from '@nestjs/swagger';
import { CreateBusinessPartnerAddressDto } from './create-address.dto';

export class UpdateBusinessPartnerAddressDto extends PartialType(CreateBusinessPartnerAddressDto) {}
