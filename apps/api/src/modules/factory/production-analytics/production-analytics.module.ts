import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { NumberingModule } from '../../numbering/numbering.module';
import { ProductionPerformanceTargetsController } from './production-performance-targets.controller';
import { ProductionPerformanceTargetsService } from './production-performance-targets.service';
import { ProductionAnalyticsController } from './production-analytics.controller';
import { ProductionAnalyticsService } from './production-analytics.service';

@Module({
  imports: [AuditModule, NumberingModule],
  controllers: [ProductionPerformanceTargetsController, ProductionAnalyticsController],
  providers: [ProductionPerformanceTargetsService, ProductionAnalyticsService],
  exports: [ProductionPerformanceTargetsService],
})
export class ProductionAnalyticsModule {}
