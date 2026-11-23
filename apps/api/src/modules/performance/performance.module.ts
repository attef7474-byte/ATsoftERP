import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PerformanceProfilesService } from './profiles/performance-profiles.service';
import { PerformanceProfilesController } from './profiles/performance-profiles.controller';
import { PerformanceProfileMappingsService } from './mappings/performance-profile-mappings.service';
import { PerformanceProfileMappingsController } from './mappings/performance-profile-mappings.controller';
import { PerformanceContextService } from './context/performance-context.service';
import { PerformanceContextController } from './context/performance-context.controller';
import { PerformanceCoverageService } from './coverage/performance-coverage.service';
import { PerformanceCoverageController } from './coverage/performance-coverage.controller';
import { PerformanceKpisService } from './kpis/performance-kpis.service';
import { PerformanceKpisController } from './kpis/performance-kpis.controller';
import { PerformanceKpiEligibilityService } from './kpi-eligibility/performance-kpi-eligibility.service';
import { PerformanceKpiEligibilityController } from './kpi-eligibility/performance-kpi-eligibility.controller';
import { PerformanceKpiPreviewService } from './kpi-preview/performance-kpi-preview.service';
import { PerformanceKpiPreviewController } from './kpi-preview/performance-kpi-preview.controller';
import { PerformanceKpiCoverageService } from './kpi-coverage/performance-kpi-coverage.service';
import { PerformanceKpiCoverageController } from './kpi-coverage/performance-kpi-coverage.controller';

@Module({
  imports: [AuditModule],
  controllers: [
    PerformanceProfilesController,
    PerformanceProfileMappingsController,
    PerformanceContextController,
    PerformanceCoverageController,
    PerformanceKpisController,
    PerformanceKpiEligibilityController,
    PerformanceKpiPreviewController,
    PerformanceKpiCoverageController,
  ],
  providers: [
    PerformanceProfilesService,
    PerformanceProfileMappingsService,
    PerformanceContextService,
    PerformanceCoverageService,
    PerformanceKpisService,
    PerformanceKpiEligibilityService,
    PerformanceKpiPreviewService,
    PerformanceKpiCoverageService,
  ],
  exports: [PerformanceContextService, PerformanceKpiPreviewService],
})
export class PerformanceModule {}
