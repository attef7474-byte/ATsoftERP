import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module';
import { ProductionFinishedGoodsReceiptsController } from './production-finished-goods-receipts.controller';
import { ProductionFinishedGoodsReceiptsService } from './production-finished-goods-receipts.service';

@Module({
  imports: [AuditModule, InventoryMovementsModule],
  controllers: [ProductionFinishedGoodsReceiptsController],
  providers: [ProductionFinishedGoodsReceiptsService],
  exports: [ProductionFinishedGoodsReceiptsService],
})
export class ProductionFinishedGoodsReceiptsModule {}
