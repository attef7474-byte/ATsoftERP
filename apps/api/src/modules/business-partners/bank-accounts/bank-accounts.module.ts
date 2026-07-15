import { Module } from '@nestjs/common';
import { BusinessPartnerBankAccountsController } from './bank-accounts.controller';
import { BusinessPartnerBankAccountsService } from './bank-accounts.service';

@Module({
  controllers: [BusinessPartnerBankAccountsController],
  providers: [BusinessPartnerBankAccountsService],
  exports: [BusinessPartnerBankAccountsService],
})
export class BusinessPartnerBankAccountsModule {}
