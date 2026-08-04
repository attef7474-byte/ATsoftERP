import { Module } from '@nestjs/common';
import { AuditModule } from '../../../common/audit/audit.module';
import { NumberingModule } from '../../numbering/numbering.module';
import { AttachmentsModule } from '../../documents/attachments/attachments.module';
import { ProductionCapacityStandardsModule } from '../production-capacity-standards/production-capacity-standards.module';
import { ProductionOrdersController } from './production-orders.controller';
import { ProductionOrdersService } from './production-orders.service';

@Module({
  imports: [AuditModule, NumberingModule, AttachmentsModule, ProductionCapacityStandardsModule],
  controllers: [ProductionOrdersController],
  providers: [ProductionOrdersService],
  exports: [ProductionOrdersService],
})
export class ProductionOrdersModule {}
