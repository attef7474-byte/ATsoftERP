import { Module } from '@nestjs/common';
import { MaintenanceWorkOrdersController } from './maintenance-work-orders.controller';
import { MaintenanceWorkOrdersService } from './maintenance-work-orders.service';
import { AuditModule } from '../../../../common/audit/audit.module';
import { InventoryValuationModule } from '../../inventory-valuation/inventory-valuation.module';
import { InventoryValuationEngineService } from '../../inventory-valuation/inventory-valuation-engine.service';
import { ProductionCostModule } from '../../production-cost/production-cost.module';

@Module({
  imports: [AuditModule, InventoryValuationModule, ProductionCostModule],
  controllers: [MaintenanceWorkOrdersController],
  providers: [MaintenanceWorkOrdersService, InventoryValuationEngineService],
  exports: [MaintenanceWorkOrdersService],
})
export class MaintenanceWorkOrdersModule {}
