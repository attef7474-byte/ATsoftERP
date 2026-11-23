import 'reflect-metadata';
import { PerformanceKpisController } from './performance-kpis.controller';
import { PerformanceKpisService } from './performance-kpis.service';

describe('PerformanceKpisController (permission gating)', () => {
  const controller = new PerformanceKpisController({} as PerformanceKpisService);
  const routePermissions = (methodName: string): string[] =>
    Reflect.getMetadata('permissions', controller[methodName as keyof PerformanceKpisController]);

  it('gates create with performance-kpi:create', () => expect(routePermissions('create')).toEqual(['performance-kpi:create']));
  it('gates list with performance-kpi:read', () => expect(routePermissions('findAll')).toEqual(['performance-kpi:read']));
  it('gates detail with performance-kpi:read', () => expect(routePermissions('findOne')).toEqual(['performance-kpi:read']));
  it('gates update with performance-kpi:update', () => expect(routePermissions('update')).toEqual(['performance-kpi:update']));
  it('gates deactivate with performance-kpi:deactivate', () => expect(routePermissions('deactivate')).toEqual(['performance-kpi:deactivate']));
  it('gates activate with performance-kpi:update', () => expect(routePermissions('activate')).toEqual(['performance-kpi:update']));
});
