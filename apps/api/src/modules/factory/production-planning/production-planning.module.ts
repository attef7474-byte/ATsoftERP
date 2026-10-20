import { Module } from '@nestjs/common';
import { AuditModule } from '../../../common/audit/audit.module';
import { ProductionCapacityStandardsModule } from '../production-capacity-standards/production-capacity-standards.module';
import { ProductionMaterialRequirementsModule } from '../production-material-requirements/production-material-requirements.module';
import { ProductionPlanningController } from './production-planning.controller';
import { ProductionPlanningService } from './production-planning.service';

@Module({
  imports: [AuditModule, ProductionCapacityStandardsModule, ProductionMaterialRequirementsModule],
  controllers: [ProductionPlanningController],
  providers: [ProductionPlanningService],
  exports: [ProductionPlanningService],
})
export class ProductionPlanningModule {}
