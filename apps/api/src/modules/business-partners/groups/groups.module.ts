import { Module } from '@nestjs/common';
import { BusinessPartnerGroupsController } from './groups.controller';
import { BusinessPartnerGroupsService } from './groups.service';

@Module({
  controllers: [BusinessPartnerGroupsController],
  providers: [BusinessPartnerGroupsService],
  exports: [BusinessPartnerGroupsService],
})
export class BusinessPartnerGroupsModule {}
