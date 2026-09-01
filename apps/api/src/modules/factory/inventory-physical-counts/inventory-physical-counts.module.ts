import { Module } from '@nestjs/common';
import { InventoryPhysicalCountsController } from './inventory-physical-counts.controller';
import { InventoryPhysicalCountsService } from './inventory-physical-counts.service';
import { AuditModule } from '../../../common/audit/audit.module';
import { InventoryValuationModule } from '../inventory-valuation/inventory-valuation.module';
import { InventoryValuationEngineService } from '../inventory-valuation/inventory-valuation-engine.service';

@Module({
  imports: [AuditModule, InventoryValuationModule],
  controllers: [InventoryPhysicalCountsController],
  providers: [InventoryPhysicalCountsService, InventoryValuationEngineService],
  exports: [InventoryPhysicalCountsService],
})
export class InventoryPhysicalCountsModule {}
