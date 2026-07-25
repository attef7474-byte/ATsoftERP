import { Module } from '@nestjs/common';
import { MaintenancePartAccountabilityController } from './maintenance-part-accountability.controller';
import { MaintenancePartAccountabilityService } from './maintenance-part-accountability.service';

@Module({
  controllers: [MaintenancePartAccountabilityController],
  providers: [MaintenancePartAccountabilityService],
  exports: [MaintenancePartAccountabilityService],
})
export class MaintenancePartAccountabilityModule {}
