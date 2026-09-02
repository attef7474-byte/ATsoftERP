import { Module } from '@nestjs/common';
import { InventoryValuationController } from './inventory-valuation.controller';
import { InventoryValuationService } from './inventory-valuation.service';
import { InventoryValuationEngineService } from './inventory-valuation-engine.service';
import { InventoryValuationReconciliationService } from './inventory-valuation-reconciliation.service';
import { AuditModule } from '../../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [InventoryValuationController],
  providers: [InventoryValuationService, InventoryValuationEngineService, InventoryValuationReconciliationService],
  exports: [InventoryValuationService, InventoryValuationEngineService, InventoryValuationReconciliationService],
})
export class InventoryValuationModule {}
