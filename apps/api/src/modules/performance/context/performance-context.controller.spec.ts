import 'reflect-metadata';
import { PerformanceContextController } from './performance-context.controller';
import { PerformanceContextService } from './performance-context.service';

describe('PerformanceContextController (permission gating)', () => {
  const controller = new PerformanceContextController({} as PerformanceContextService);
  const routePermissions = (methodName: string): string[] =>
    Reflect.getMetadata('permissions', controller[methodName as keyof PerformanceContextController]);

  it('gates employee context with performance-context:read', () => {
    expect(routePermissions('resolve')).toEqual(['performance-context:read']);
  });
});
