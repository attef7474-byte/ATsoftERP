import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module';
import { ProductionFinishedGoodsReceiptsController } from './production-finished-goods-receipts.controller';
import { ProductionFinishedGoodsReceiptsService } from './production-finished-goods-receipts.service';
import { ProductionRunsModule } from '../production-runs/production-runs.module';
import { InventoryValuationModule } from '../inventory-valuation/inventory-valuation.module';

@Module({
  imports: [AuditModule, InventoryMovementsModule, ProductionRunsModule, InventoryValuationModule],
  controllers: [ProductionFinishedGoodsReceiptsController],
  providers: [ProductionFinishedGoodsReceiptsService],
  exports: [ProductionFinishedGoodsReceiptsService],
})
export class ProductionFinishedGoodsReceiptsModule {}
