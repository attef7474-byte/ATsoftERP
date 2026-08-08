import { Module } from '@nestjs/common';
import { ProductionCostController } from './production-cost.controller';
import { ProductionCostService } from './production-cost.service';
import { AuditModule } from '../../audit/audit.module';
import { OperationalSourceChangesModule } from '../operational-source-changes/operational-source-changes.module';
import { CostCentersModule } from '../maintenance/cost-centers/cost-centers.module';

@Module({
  imports: [AuditModule, OperationalSourceChangesModule, CostCentersModule],
  controllers: [ProductionCostController],
  providers: [ProductionCostService],
  exports: [ProductionCostService],
})
export class ProductionCostModule {}
