import 'reflect-metadata';
import { PerformanceKpiCoverageController } from './performance-kpi-coverage.controller';
import { PerformanceKpiCoverageService } from './performance-kpi-coverage.service';

describe('PerformanceKpiCoverageController (permission gating)', () => {
  const controller = new PerformanceKpiCoverageController({} as PerformanceKpiCoverageService);
  const routePermissions = (methodName: string): string[] =>
    Reflect.getMetadata('permissions', controller[methodName as keyof PerformanceKpiCoverageController]);

  it('gates coverage with performance-kpi-coverage:read', () => {
    expect(routePermissions('coverage')).toEqual(['performance-kpi-coverage:read']);
  });
});
