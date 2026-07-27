import { Module } from '@nestjs/common'
import { AuditModule } from '../../../common/audit/audit.module'
import { InventoryLedgerReconciliationController } from './inventory-ledger-reconciliation.controller'
import { InventoryLedgerReconciliationService } from './inventory-ledger-reconciliation.service'

@Module({
  imports: [AuditModule],
  controllers: [InventoryLedgerReconciliationController],
  providers: [InventoryLedgerReconciliationService],
  exports: [InventoryLedgerReconciliationService],
})
export class InventoryLedgerReconciliationModule {}
