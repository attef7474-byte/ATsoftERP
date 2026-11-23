import 'reflect-metadata';
import { PerformanceProfileMappingsController } from './performance-profile-mappings.controller';
import { PerformanceProfileMappingsService } from './performance-profile-mappings.service';

describe('PerformanceProfileMappingsController (permission gating)', () => {
  const controller = new PerformanceProfileMappingsController({} as PerformanceProfileMappingsService);
  const routePermissions = (methodName: string): string[] =>
    Reflect.getMetadata('permissions', controller[methodName as keyof PerformanceProfileMappingsController]);

  it('gates create with performance-profile-mapping:create', () => {
    expect(routePermissions('create')).toEqual(['performance-profile-mapping:create']);
  });
  it('gates list with performance-profile-mapping:read', () => {
    expect(routePermissions('findAll')).toEqual(['performance-profile-mapping:read']);
  });
  it('gates detail with performance-profile-mapping:read', () => {
    expect(routePermissions('findOne')).toEqual(['performance-profile-mapping:read']);
  });
  it('gates update with performance-profile-mapping:update', () => {
    expect(routePermissions('update')).toEqual(['performance-profile-mapping:update']);
  });
  it('gates deactivate with performance-profile-mapping:deactivate', () => {
    expect(routePermissions('deactivate')).toEqual(['performance-profile-mapping:deactivate']);
  });
  it('gates activate with performance-profile-mapping:update', () => {
    expect(routePermissions('activate')).toEqual(['performance-profile-mapping:update']);
  });
});
