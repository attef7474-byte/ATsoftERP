import { Module } from '@nestjs/common';
import { BusinessPartnersController } from './partners.controller';
import { BusinessPartnersService } from './partners.service';

@Module({
  controllers: [BusinessPartnersController],
  providers: [BusinessPartnersService],
  exports: [BusinessPartnersService],
})
export class BusinessPartnersModule {}
