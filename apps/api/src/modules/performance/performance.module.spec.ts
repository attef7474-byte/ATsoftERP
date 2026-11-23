import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { PerformanceModule } from './performance.module';
import { PerformanceKpiCoverageController } from './kpi-coverage/performance-kpi-coverage.controller';
import { PerformanceKpisController } from './kpis/performance-kpis.controller';

describe('PerformanceModule', () => {
  it('registers KPI coverage controller before KPIs :id controller to prevent /coverage route collision', () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, PerformanceModule) || [];
    const coverageIdx = controllers.indexOf(PerformanceKpiCoverageController);
    const kpisIdx = controllers.indexOf(PerformanceKpisController);
    expect(coverageIdx).toBeGreaterThanOrEqual(0);
    expect(kpisIdx).toBeGreaterThanOrEqual(0);
    expect(coverageIdx).toBeLessThan(kpisIdx);
  });
});
