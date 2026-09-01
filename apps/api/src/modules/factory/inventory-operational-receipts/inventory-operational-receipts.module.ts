import { Module } from '@nestjs/common';
import { InventoryOperationalReceiptsController } from './inventory-operational-receipts.controller';
import { InventoryOperationalReceiptsService } from './inventory-operational-receipts.service';
import { AuditModule } from '../../../common/audit/audit.module';
import { InventoryValuationModule } from '../inventory-valuation/inventory-valuation.module';
import { InventoryValuationEngineService } from '../inventory-valuation/inventory-valuation-engine.service';

@Module({
  imports: [AuditModule, InventoryValuationModule],
  controllers: [InventoryOperationalReceiptsController],
  providers: [InventoryOperationalReceiptsService, InventoryValuationEngineService],
  exports: [InventoryOperationalReceiptsService],
})
export class InventoryOperationalReceiptsModule {}
