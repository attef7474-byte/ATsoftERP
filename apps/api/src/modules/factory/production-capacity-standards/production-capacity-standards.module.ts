import { Module } from '@nestjs/common';
import { AuditModule } from '../../../common/audit/audit.module';
import { NumberingModule } from '../../numbering/numbering.module';
import { ProductionCapacityStandardsController } from './production-capacity-standards.controller';
import { ProductionCapacityStandardsService } from './production-capacity-standards.service';

@Module({
  imports: [AuditModule, NumberingModule],
  controllers: [ProductionCapacityStandardsController],
  providers: [ProductionCapacityStandardsService],
  exports: [ProductionCapacityStandardsService],
})
export class ProductionCapacityStandardsModule {}
