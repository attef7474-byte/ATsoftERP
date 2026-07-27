import { Module } from '@nestjs/common';
import { InventoryStockAdjustmentsController } from './inventory-stock-adjustments.controller';
import { InventoryStockAdjustmentsService } from './inventory-stock-adjustments.service';
import { AuditModule } from '../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [InventoryStockAdjustmentsController],
  providers: [InventoryStockAdjustmentsService],
  exports: [InventoryStockAdjustmentsService],
})
export class InventoryStockAdjustmentsModule {}
