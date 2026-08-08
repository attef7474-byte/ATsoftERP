import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { ProductionMaterialRequirementsController } from './production-material-requirements.controller';
import { ProductionMaterialRequirementsService } from './production-material-requirements.service';

@Module({
  imports: [AuditModule],
  controllers: [ProductionMaterialRequirementsController],
  providers: [ProductionMaterialRequirementsService],
  exports: [ProductionMaterialRequirementsService],
})
export class ProductionMaterialRequirementsModule {}
