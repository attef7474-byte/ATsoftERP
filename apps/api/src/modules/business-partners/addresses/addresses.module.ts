import { Module } from '@nestjs/common';
import { BusinessPartnerAddressesController } from './addresses.controller';
import { BusinessPartnerAddressesService } from './addresses.service';

@Module({
  controllers: [BusinessPartnerAddressesController],
  providers: [BusinessPartnerAddressesService],
  exports: [BusinessPartnerAddressesService],
})
export class BusinessPartnerAddressesModule {}
