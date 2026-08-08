import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { ProductionLossReasonsController } from './production-loss-reasons.controller';
import { ProductionLossReasonsService } from './production-loss-reasons.service';

@Module({
  imports: [AuditModule],
  controllers: [ProductionLossReasonsController],
  providers: [ProductionLossReasonsService],
  exports: [ProductionLossReasonsService],
})
export class ProductionLossReasonsModule {}
