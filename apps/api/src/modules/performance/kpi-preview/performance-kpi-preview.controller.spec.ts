import 'reflect-metadata';
import { PerformanceKpiPreviewController } from './performance-kpi-preview.controller';
import { PerformanceKpiPreviewService } from './performance-kpi-preview.service';

describe('PerformanceKpiPreviewController (permission gating)', () => {
  const controller = new PerformanceKpiPreviewController({} as PerformanceKpiPreviewService);
  const routePermissions = (methodName: string): string[] =>
    Reflect.getMetadata('permissions', controller[methodName as keyof PerformanceKpiPreviewController]);

  it('gates preview with performance-kpi-preview:read', () => {
    expect(routePermissions('preview')).toEqual(['performance-kpi-preview:read']);
  });
});
