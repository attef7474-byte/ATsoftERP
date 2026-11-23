import 'reflect-metadata';
import { PerformanceKpiEligibilityController } from './performance-kpi-eligibility.controller';
import { PerformanceKpiEligibilityService } from './performance-kpi-eligibility.service';

describe('PerformanceKpiEligibilityController (permission gating)', () => {
  const controller = new PerformanceKpiEligibilityController({} as PerformanceKpiEligibilityService);
  const routePermissions = (methodName: string): string[] =>
    Reflect.getMetadata('permissions', controller[methodName as keyof PerformanceKpiEligibilityController]);

  it('gates create', () => expect(routePermissions('create')).toEqual(['performance-profile-kpi-eligibility:create']));
  it('gates list', () => expect(routePermissions('findAll')).toEqual(['performance-profile-kpi-eligibility:read']));
  it('gates detail', () => expect(routePermissions('findOne')).toEqual(['performance-profile-kpi-eligibility:read']));
  it('gates update', () => expect(routePermissions('update')).toEqual(['performance-profile-kpi-eligibility:update']));
  it('gates deactivate', () => expect(routePermissions('deactivate')).toEqual(['performance-profile-kpi-eligibility:deactivate']));
  it('gates activate', () => expect(routePermissions('activate')).toEqual(['performance-profile-kpi-eligibility:update']));
});
