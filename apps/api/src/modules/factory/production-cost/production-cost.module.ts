import { Module } from '@nestjs/common';
import { ProductionCostController } from './production-cost.controller';
import { ProductionCostService } from './production-cost.service';
import { OperationalCostReconciliationService } from './operational-cost-reconciliation.service';
import { AuditModule } from '../../audit/audit.module';
import { OperationalSourceChangesModule } from '../operational-source-changes/operational-source-changes.module';
import { CostCentersModule } from '../maintenance/cost-centers/cost-centers.module';
import { MaintenanceCostSummaryService } from './maintenance-cost-summary.service';
import { MaintenanceCostSummaryController } from './maintenance-cost-summary.controller';

@Module({
  imports: [AuditModule, OperationalSourceChangesModule, CostCentersModule],
  controllers: [ProductionCostController, MaintenanceCostSummaryController],
  providers: [ProductionCostService, OperationalCostReconciliationService, MaintenanceCostSummaryService],
  exports: [ProductionCostService, OperationalCostReconciliationService, MaintenanceCostSummaryService],
})
export class ProductionCostModule {}
