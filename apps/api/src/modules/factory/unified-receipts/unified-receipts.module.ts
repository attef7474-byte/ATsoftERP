import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { InventoryOperationalReceiptsModule } from '../inventory-operational-receipts/inventory-operational-receipts.module';
import { ProductionFinishedGoodsReceiptsModule } from '../production-finished-goods-receipts/production-finished-goods-receipts.module';
import { UnifiedReceiptsController } from './unified-receipts.controller';
import { UnifiedReceiptsService } from './unified-receipts.service';

@Module({
  imports: [PrismaModule, InventoryOperationalReceiptsModule, ProductionFinishedGoodsReceiptsModule],
  controllers: [UnifiedReceiptsController],
  providers: [UnifiedReceiptsService],
  exports: [UnifiedReceiptsService],
})
export class UnifiedReceiptsModule {}
