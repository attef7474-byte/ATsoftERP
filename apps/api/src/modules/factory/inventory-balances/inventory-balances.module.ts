import { Module } from '@nestjs/common';
import { InventoryBalancesController, InventorySummaryController } from './inventory-balances.controller';
import { InventoryBalancesService } from './inventory-balances.service';
import { AuditModule } from '../../../common/audit/audit.module';
import { InventoryValuationModule } from '../inventory-valuation/inventory-valuation.module';
import { InventoryValuationEngineService } from '../inventory-valuation/inventory-valuation-engine.service';

@Module({
  imports: [AuditModule, InventoryValuationModule],
  controllers: [InventoryBalancesController, InventorySummaryController],
  providers: [InventoryBalancesService, InventoryValuationEngineService],
  exports: [InventoryBalancesService],
})
export class InventoryBalancesModule {}
