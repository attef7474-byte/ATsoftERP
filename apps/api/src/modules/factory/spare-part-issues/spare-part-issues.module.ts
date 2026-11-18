import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module';
import { SparePartIssuesController } from './spare-part-issues.controller';
import { SparePartIssuesService } from './spare-part-issues.service';

@Module({
  imports: [AuditModule, InventoryMovementsModule],
  controllers: [SparePartIssuesController],
  providers: [SparePartIssuesService],
  exports: [SparePartIssuesService],
})
export class SparePartIssuesModule {}
