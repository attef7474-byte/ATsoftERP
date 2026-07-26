import { Module } from '@nestjs/common';
import { MaintenanceSlaController } from './maintenance-sla.controller';
import { MaintenanceSlaService } from './maintenance-sla.service';

@Module({
  controllers: [MaintenanceSlaController],
  providers: [MaintenanceSlaService],
  exports: [MaintenanceSlaService],
})
export class MaintenanceSlaModule {}
