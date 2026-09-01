import { Module } from '@nestjs/common';
import { AuditModule } from '../../../common/audit/audit.module';
import { NumberingModule } from '../../numbering/numbering.module';
import { ProductionOrdersModule } from '../production-orders/production-orders.module';
import { ProductionLossQuantityEventsModule } from '../production-loss-quantity-events/production-loss-quantity-events.module';
import { InventoryValuationModule } from '../inventory-valuation/inventory-valuation.module';
import { ProductionRunsController } from './production-runs.controller';
import { ProductionOutputEventsController } from './production-output-events.controller';
import { ProductionMeasurementPointsController } from './production-measurement-points.controller';
import { ProductionRunsService } from './production-runs.service';
import { ProductionMeasurementPointsService } from './production-measurement-points.service';
import { ProductionRunCostAggregationService } from './production-run-cost-aggregation.service';

@Module({
  imports: [AuditModule, NumberingModule, ProductionLossQuantityEventsModule, ProductionOrdersModule, InventoryValuationModule],
  controllers: [ProductionRunsController, ProductionOutputEventsController, ProductionMeasurementPointsController],
  providers: [ProductionRunsService, ProductionMeasurementPointsService, ProductionRunCostAggregationService],
  exports: [ProductionRunsService, ProductionRunCostAggregationService],
})
export class ProductionRunsModule {}