import { Module } from '@nestjs/common';
import { ProductionCostController } from './production-cost.controller';
import { ProductionCostService } from './production-cost.service';
import { AuditModule } from '../../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ProductionCostController],
  providers: [ProductionCostService],
  exports: [ProductionCostService],
})
export class ProductionCostModule {}
