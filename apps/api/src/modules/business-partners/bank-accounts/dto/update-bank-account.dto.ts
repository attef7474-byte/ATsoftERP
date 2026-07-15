import { PartialType } from '@nestjs/swagger';
import { CreateBusinessPartnerBankAccountDto } from './create-bank-account.dto';

export class UpdateBusinessPartnerBankAccountDto extends PartialType(CreateBusinessPartnerBankAccountDto) {}
