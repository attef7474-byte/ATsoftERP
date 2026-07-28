import { Module } from '@nestjs/common'
import { InventoryLocksController } from './inventory-locks.controller'
import { InventoryAuditController } from './inventory-audit.controller'
import { InventoryLocksService } from './inventory-locks.service'
import { PrismaModule } from '../../../common/prisma/prisma.module'
import { AuditModule } from '../../../common/audit/audit.module'
import { InventoryLockGuard } from '../../../common/guards/inventory-lock.guard'

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [InventoryLocksController, InventoryAuditController],
  providers: [InventoryLocksService, InventoryLockGuard],
  exports: [InventoryLocksService, InventoryLockGuard],
})
export class InventoryLocksModule {}
