import { Module } from '@nestjs/common';
import { InventoryOpeningBalancesController } from './inventory-opening-balances.controller';
import { InventoryOpeningBalancesService } from './inventory-opening-balances.service';
import { AuditModule } from '../../../common/audit/audit.module';
import { InventoryValuationModule } from '../inventory-valuation/inventory-valuation.module';
import { InventoryValuationEngineService } from '../inventory-valuation/inventory-valuation-engine.service';

@Module({
  imports: [AuditModule, InventoryValuationModule],
  controllers: [InventoryOpeningBalancesController],
  providers: [InventoryOpeningBalancesService, InventoryValuationEngineService],
  exports: [InventoryOpeningBalancesService],
})
export class InventoryOpeningBalancesModule {}
