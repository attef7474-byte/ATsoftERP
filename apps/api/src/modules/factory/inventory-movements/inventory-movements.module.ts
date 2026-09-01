import { Module } from '@nestjs/common';
import { InventoryMovementsController } from './inventory-movements.controller';
import { InventoryMovementsService } from './inventory-movements.service';
import { AuditModule } from '../../../common/audit/audit.module';
import { InventoryValuationModule } from '../inventory-valuation/inventory-valuation.module';
import { InventoryValuationEngineService } from '../inventory-valuation/inventory-valuation-engine.service';

@Module({
  imports: [AuditModule, InventoryValuationModule],
  controllers: [InventoryMovementsController],
  providers: [InventoryMovementsService, InventoryValuationEngineService],
  exports: [InventoryMovementsService],
})
export class InventoryMovementsModule {}
