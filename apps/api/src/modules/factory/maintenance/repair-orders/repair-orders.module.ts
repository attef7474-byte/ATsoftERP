import { Module } from '@nestjs/common';
import { RepairOrdersController } from './repair-orders.controller';
import { RepairOrdersService } from './repair-orders.service';
import { AuditModule } from '../../../../common/audit/audit.module';
import { SparePartConditionModule } from '../spare-part-conditions/spare-part-conditions.module';

@Module({
  imports: [AuditModule, SparePartConditionModule],
  controllers: [RepairOrdersController],
  providers: [RepairOrdersService],
  exports: [RepairOrdersService],
})
export class RepairOrdersModule {}
