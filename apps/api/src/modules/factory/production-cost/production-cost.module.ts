import { Module } from '@nestjs/common';
import { ProductionCostController } from './production-cost.controller';
import { ProductionCostService } from './production-cost.service';
import { OperationalCostReconciliationService } from './operational-cost-reconciliation.service';
import { AuditModule } from '../../audit/audit.module';
import { OperationalSourceChangesModule } from '../operational-source-changes/operational-source-changes.module';
import { CostCentersModule } from '../maintenance/cost-centers/cost-centers.module';

@Module({
  imports: [AuditModule, OperationalSourceChangesModule, CostCentersModule],
  controllers: [ProductionCostController],
  providers: [ProductionCostService, OperationalCostReconciliationService],
  exports: [ProductionCostService, OperationalCostReconciliationService],
})
export class ProductionCostModule {}
