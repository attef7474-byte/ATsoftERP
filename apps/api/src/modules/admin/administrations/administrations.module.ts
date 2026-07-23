import { Module } from '@nestjs/common';
import { AdministrationsController } from './administrations.controller';
import { AdministrationsService } from './administrations.service';

@Module({
  controllers: [AdministrationsController],
  providers: [AdministrationsService],
  exports: [AdministrationsService],
})
export class AdministrationsModule {}
