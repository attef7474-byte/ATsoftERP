import 'reflect-metadata';
import { PerformanceCoverageController } from './performance-coverage.controller';
import { PerformanceCoverageService } from './performance-coverage.service';

describe('PerformanceCoverageController (permission gating)', () => {
  const controller = new PerformanceCoverageController({} as PerformanceCoverageService);
  const routePermissions = (methodName: string): string[] =>
    Reflect.getMetadata('permissions', controller[methodName as keyof PerformanceCoverageController]);

  it('gates summary with performance-coverage:read', () => {
    expect(routePermissions('summary')).toEqual(['performance-coverage:read']);
  });
  it('gates employee coverage with performance-coverage:read', () => {
    expect(routePermissions('employees')).toEqual(['performance-coverage:read']);
  });
});
