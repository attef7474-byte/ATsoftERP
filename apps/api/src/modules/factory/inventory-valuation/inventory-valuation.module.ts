import { Module } from '@nestjs/common';
import { InventoryValuationController } from './inventory-valuation.controller';
import { InventoryValuationService } from './inventory-valuation.service';
import { AuditModule } from '../../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [InventoryValuationController],
  providers: [InventoryValuationService],
  exports: [InventoryValuationService],
})
export class InventoryValuationModule {}
