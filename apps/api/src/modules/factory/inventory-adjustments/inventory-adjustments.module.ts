import { Module } from '@nestjs/common';
import { InventoryAdjustmentsController, InventoryAdjustmentCountsController, InventoryAdjustmentFromCountController } from './inventory-adjustments.controller';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';
import { AuditModule } from '../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [InventoryAdjustmentsController, InventoryAdjustmentCountsController, InventoryAdjustmentFromCountController],
  providers: [InventoryAdjustmentsService],
  exports: [InventoryAdjustmentsService],
})
export class InventoryAdjustmentsModule {}
