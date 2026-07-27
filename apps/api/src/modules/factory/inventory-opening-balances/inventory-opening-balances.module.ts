import { Module } from '@nestjs/common';
import { InventoryOpeningBalancesController } from './inventory-opening-balances.controller';
import { InventoryOpeningBalancesService } from './inventory-opening-balances.service';
import { AuditModule } from '../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [InventoryOpeningBalancesController],
  providers: [InventoryOpeningBalancesService],
  exports: [InventoryOpeningBalancesService],
})
export class InventoryOpeningBalancesModule {}
