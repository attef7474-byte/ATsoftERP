import { Module } from '@nestjs/common';
import { BusinessPartnerContactsController } from './contacts.controller';
import { BusinessPartnerContactsService } from './contacts.service';

@Module({
  controllers: [BusinessPartnerContactsController],
  providers: [BusinessPartnerContactsService],
  exports: [BusinessPartnerContactsService],
})
export class BusinessPartnerContactsModule {}
