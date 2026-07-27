import { Module } from '@nestjs/common';
import { InventoryPhysicalCountsController } from './inventory-physical-counts.controller';
import { InventoryPhysicalCountsService } from './inventory-physical-counts.service';
import { AuditModule } from '../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [InventoryPhysicalCountsController],
  providers: [InventoryPhysicalCountsService],
  exports: [InventoryPhysicalCountsService],
})
export class InventoryPhysicalCountsModule {}
