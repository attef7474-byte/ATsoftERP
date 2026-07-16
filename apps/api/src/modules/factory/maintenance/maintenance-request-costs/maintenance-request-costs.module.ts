import { Module } from '@nestjs/common';
import { MaintenanceRequestCostsController } from './maintenance-request-costs.controller';
import { MaintenanceRequestCostsService } from './maintenance-request-costs.service';
import { AuditModule } from '../../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [MaintenanceRequestCostsController],
  providers: [MaintenanceRequestCostsService],
  exports: [MaintenanceRequestCostsService],
})
export class MaintenanceRequestCostsModule {}
