import 'reflect-metadata';
import { PerformanceProfilesController } from './performance-profiles.controller';
import { PerformanceProfilesService } from './performance-profiles.service';

describe('PerformanceProfilesController (permission gating)', () => {
  const controller = new PerformanceProfilesController({} as PerformanceProfilesService);
  const routePermissions = (methodName: string): string[] =>
    Reflect.getMetadata('permissions', controller[methodName as keyof PerformanceProfilesController]);

  it('gates create with performance-profile:create', () => {
    expect(routePermissions('create')).toEqual(['performance-profile:create']);
  });
  it('gates list with performance-profile:read', () => {
    expect(routePermissions('findAll')).toEqual(['performance-profile:read']);
  });
  it('gates detail with performance-profile:read', () => {
    expect(routePermissions('findOne')).toEqual(['performance-profile:read']);
  });
  it('gates update with performance-profile:update', () => {
    expect(routePermissions('update')).toEqual(['performance-profile:update']);
  });
  it('gates deactivate with performance-profile:deactivate', () => {
    expect(routePermissions('deactivate')).toEqual(['performance-profile:deactivate']);
  });
  it('gates activate with performance-profile:update', () => {
    expect(routePermissions('activate')).toEqual(['performance-profile:update']);
  });
});
