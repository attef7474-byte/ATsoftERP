import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module';
import { GeneralInventoryIssuesController } from './general-inventory-issues.controller';
import { GeneralInventoryIssuesService } from './general-inventory-issues.service';

@Module({
  imports: [AuditModule, InventoryMovementsModule],
  controllers: [GeneralInventoryIssuesController],
  providers: [GeneralInventoryIssuesService],
  exports: [GeneralInventoryIssuesService],
})
export class GeneralInventoryIssuesModule {}
