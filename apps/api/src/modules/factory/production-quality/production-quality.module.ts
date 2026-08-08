import { Module } from '@nestjs/common';
import { ProductionQualityController } from './production-quality.controller';
import { ProductionQualityService } from './production-quality.service';
import { NumberingModule } from '../../numbering/numbering.module';
import { AuditModule } from '../../audit/audit.module';

@Module({
  imports: [NumberingModule, AuditModule],
  controllers: [ProductionQualityController],
  providers: [ProductionQualityService],
  exports: [ProductionQualityService],
})
export class ProductionQualityModule {}
