import { Module } from '@nestjs/common';
import { MaintenancePersonnelController } from './maintenance-personnel.controller';
import { MaintenancePersonnelService } from './maintenance-personnel.service';

@Module({
  controllers: [MaintenancePersonnelController],
  providers: [MaintenancePersonnelService],
  exports: [MaintenancePersonnelService],
})
export class MaintenancePersonnelModule {}
