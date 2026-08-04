import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { ProductionLossQuantityEventsController } from './production-loss-quantity-events.controller';
import { ProductionLossQuantityEventsService } from './production-loss-quantity-events.service';

@Module({
  imports: [AuditModule],
  controllers: [ProductionLossQuantityEventsController],
  providers: [ProductionLossQuantityEventsService],
  exports: [ProductionLossQuantityEventsService],
})
export class ProductionLossQuantityEventsModule {}
