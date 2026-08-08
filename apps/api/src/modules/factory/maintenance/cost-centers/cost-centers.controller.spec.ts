import 'reflect-metadata';
import { CostCentersController } from './cost-centers.controller';
import { COST_CENTER_PERMISSION_KEYS } from './cost-centers.constants';

describe('CostCentersController (permission gating)', () => {
  const controller = new CostCentersController({} as any);

  const routePermissions = (methodName: string): string[] =>
    Reflect.getMetadata('permissions', controller[methodName as keyof CostCentersController]);

  it('gates master-data create with operational-cost-center:create', () => {
    expect(routePermissions('create')).toEqual([COST_CENTER_PERMISSION_KEYS.create]);
  });

  it('gates list and detail reads with operational-cost-center:read', () => {
    expect(routePermissions('findAll')).toEqual([COST_CENTER_PERMISSION_KEYS.read]);
    expect(routePermissions('findOne')).toEqual([COST_CENTER_PERMISSION_KEYS.read]);
  });

  it('gates update with operational-cost-center:update', () => {
    expect(routePermissions('update')).toEqual([COST_CENTER_PERMISSION_KEYS.update]);
  });

  it('gates delete with operational-cost-center:delete', () => {
    expect(routePermissions('remove')).toEqual([COST_CENTER_PERMISSION_KEYS.delete]);
  });

  it('gates activate with operational-cost-center:activate', () => {
    expect(routePermissions('activate')).toEqual([COST_CENTER_PERMISSION_KEYS.activate]);
  });

  it('gates deactivate with operational-cost-center:deactivate', () => {
    expect(routePermissions('deactivate')).toEqual([COST_CENTER_PERMISSION_KEYS.deactivate]);
  });

  it('gates assignment CRUD with operational-cost-center:assign', () => {
    expect(routePermissions('createAssignment')).toEqual([COST_CENTER_PERMISSION_KEYS.assign]);
    expect(routePermissions('findAssignments')).toEqual([COST_CENTER_PERMISSION_KEYS.assign]);
    expect(routePermissions('findAssignment')).toEqual([COST_CENTER_PERMISSION_KEYS.assign]);
    expect(routePermissions('updateAssignment')).toEqual([COST_CENTER_PERMISSION_KEYS.assign]);
    expect(routePermissions('removeAssignment')).toEqual([COST_CENTER_PERMISSION_KEYS.assign]);
  });

  it('gates assignment transitions with operational-cost-center:assign', () => {
    expect(routePermissions('transitionAssignment')).toEqual([COST_CENTER_PERMISSION_KEYS.assign]);
  });

  it('gates resolution with operational-cost-center:read', () => {
    expect(routePermissions('resolve')).toEqual([COST_CENTER_PERMISSION_KEYS.read]);
  });
});
