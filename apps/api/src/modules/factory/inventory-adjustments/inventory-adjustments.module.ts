import { Module } from '@nestjs/common';
import { InventoryAdjustmentsController, InventoryAdjustmentCountsController } from './inventory-adjustments.controller';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';
import { AuditModule } from '../../../common/audit/audit.module';
import { InventoryValuationModule } from '../inventory-valuation/inventory-valuation.module';
import { InventoryValuationEngineService } from '../inventory-valuation/inventory-valuation-engine.service';

@Module({
  imports: [AuditModule, InventoryValuationModule],
  controllers: [InventoryAdjustmentsController, InventoryAdjustmentCountsController],
  providers: [InventoryAdjustmentsService, InventoryValuationEngineService],
  exports: [InventoryAdjustmentsService],
})
export class InventoryAdjustmentsModule {}
