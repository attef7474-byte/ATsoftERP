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

@Module({
  imports: [AuditModule],
  controllers: [
    PerformanceProfilesController,
    PerformanceProfileMappingsController,
    PerformanceContextController,
    PerformanceCoverageController,
  ],
  providers: [
    PerformanceProfilesService,
    PerformanceProfileMappingsService,
    PerformanceContextService,
    PerformanceCoverageService,
  ],
  exports: [PerformanceContextService],
})
export class PerformanceModule {}
