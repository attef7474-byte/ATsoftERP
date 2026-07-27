import { Module } from '@nestjs/common';
import { InventoryOperationalReceiptsController } from './inventory-operational-receipts.controller';
import { InventoryOperationalReceiptsService } from './inventory-operational-receipts.service';
import { AuditModule } from '../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [InventoryOperationalReceiptsController],
  providers: [InventoryOperationalReceiptsService],
  exports: [InventoryOperationalReceiptsService],
})
export class InventoryOperationalReceiptsModule {}
