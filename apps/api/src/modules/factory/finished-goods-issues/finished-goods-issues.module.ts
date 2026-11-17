import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module';
import { FinishedGoodsIssuesController } from './finished-goods-issues.controller';
import { FinishedGoodsIssuesService } from './finished-goods-issues.service';

@Module({
  imports: [AuditModule, InventoryMovementsModule],
  controllers: [FinishedGoodsIssuesController],
  providers: [FinishedGoodsIssuesService],
  exports: [FinishedGoodsIssuesService],
})
export class FinishedGoodsIssuesModule {}
