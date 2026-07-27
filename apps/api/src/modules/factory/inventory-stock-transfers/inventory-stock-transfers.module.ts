import { Module } from '@nestjs/common';
import { InventoryStockTransfersController } from './inventory-stock-transfers.controller';
import { InventoryStockTransfersService } from './inventory-stock-transfers.service';
import { AuditModule } from '../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [InventoryStockTransfersController],
  providers: [InventoryStockTransfersService],
  exports: [InventoryStockTransfersService],
})
export class InventoryStockTransfersModule {}
