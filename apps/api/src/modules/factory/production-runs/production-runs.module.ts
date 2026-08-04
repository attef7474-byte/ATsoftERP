import { Module } from '@nestjs/common';
import { AuditModule } from '../../../common/audit/audit.module';
import { NumberingModule } from '../../numbering/numbering.module';
import { ProductionLossQuantityEventsModule } from '../production-loss-quantity-events/production-loss-quantity-events.module';
import { ProductionRunsController } from './production-runs.controller';
import { ProductionOutputEventsController } from './production-output-events.controller';
import { ProductionMeasurementPointsController } from './production-measurement-points.controller';
import { ProductionRunsService } from './production-runs.service';
import { ProductionMeasurementPointsService } from './production-measurement-points.service';

@Module({
  imports: [AuditModule, NumberingModule, ProductionLossQuantityEventsModule],
  controllers: [ProductionRunsController, ProductionOutputEventsController, ProductionMeasurementPointsController],
  providers: [ProductionRunsService, ProductionMeasurementPointsService],
  exports: [ProductionRunsService],
})
export class ProductionRunsModule {}