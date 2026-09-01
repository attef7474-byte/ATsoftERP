import { Module } from '@nestjs/common';
import { InventoryStockTransfersController } from './inventory-stock-transfers.controller';
import { InventoryStockTransfersService } from './inventory-stock-transfers.service';
import { AuditModule } from '../../../common/audit/audit.module';
import { InventoryValuationModule } from '../inventory-valuation/inventory-valuation.module';
import { InventoryValuationEngineService } from '../inventory-valuation/inventory-valuation-engine.service';

@Module({
  imports: [AuditModule, InventoryValuationModule],
  controllers: [InventoryStockTransfersController],
  providers: [InventoryStockTransfersService, InventoryValuationEngineService],
  exports: [InventoryStockTransfersService],
})
export class InventoryStockTransfersModule {}
