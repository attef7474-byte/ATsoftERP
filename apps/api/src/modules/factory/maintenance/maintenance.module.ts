import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { AuditModule } from '../../../common/audit/audit.module';
import { CostCentersModule } from './cost-centers/cost-centers.module';

@Module({
  imports: [AuditModule, CostCentersModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
