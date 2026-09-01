import { Module } from '@nestjs/common';
import { InventoryStockAdjustmentsController } from './inventory-stock-adjustments.controller';
import { InventoryStockAdjustmentsService } from './inventory-stock-adjustments.service';
import { AuditModule } from '../../../common/audit/audit.module';
import { InventoryValuationModule } from '../inventory-valuation/inventory-valuation.module';
import { InventoryValuationEngineService } from '../inventory-valuation/inventory-valuation-engine.service';

@Module({
  imports: [AuditModule, InventoryValuationModule],
  controllers: [InventoryStockAdjustmentsController],
  providers: [InventoryStockAdjustmentsService, InventoryValuationEngineService],
  exports: [InventoryStockAdjustmentsService],
})
export class InventoryStockAdjustmentsModule {}
