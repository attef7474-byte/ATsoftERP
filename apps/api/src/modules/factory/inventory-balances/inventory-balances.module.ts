import { Module } from '@nestjs/common';
import { InventoryBalancesController, InventorySummaryController } from './inventory-balances.controller';
import { InventoryBalancesService } from './inventory-balances.service';
import { AuditModule } from '../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [InventoryBalancesController, InventorySummaryController],
  providers: [InventoryBalancesService],
  exports: [InventoryBalancesService],
})
export class InventoryBalancesModule {}
