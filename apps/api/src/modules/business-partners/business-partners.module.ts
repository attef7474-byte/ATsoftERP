import { Module } from '@nestjs/common';
import { BusinessPartnerGroupsModule } from './groups/groups.module';
import { PaymentTermsModule } from './payment-terms/payment-terms.module';
import { BusinessPartnersModule as PartnersModule } from './partners/partners.module';
import { BusinessPartnerContactsModule } from './contacts/contacts.module';
import { BusinessPartnerAddressesModule } from './addresses/addresses.module';
import { BusinessPartnerBankAccountsModule } from './bank-accounts/bank-accounts.module';

@Module({
  imports: [
    BusinessPartnerGroupsModule,
    PaymentTermsModule,
    PartnersModule,
    BusinessPartnerContactsModule,
    BusinessPartnerAddressesModule,
    BusinessPartnerBankAccountsModule,
  ],
})
export class BusinessPartnersModule {}
