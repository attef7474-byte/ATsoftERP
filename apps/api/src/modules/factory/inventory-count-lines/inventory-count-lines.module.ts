import { Module } from '@nestjs/common';
import { InventoryCountLinesController } from './inventory-count-lines.controller';
import { InventoryCountLinesService } from './inventory-count-lines.service';
import { AuditModule } from '../../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [InventoryCountLinesController],
  providers: [InventoryCountLinesService],
  exports: [InventoryCountLinesService],
})
export class InventoryCountLinesModule {}
