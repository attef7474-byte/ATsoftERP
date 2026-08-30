import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { CanActivate } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';

const PERMISSIONS_KEY = 'permissions';
const AlwaysTrueGuard: CanActivate = { canActivate: () => true };

describe('EmployeesController permissions', () => {
  let reflector: Reflector;
  let controller: EmployeesController;

  beforeEach(async () => {
    reflector = new Reflector();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [{ provide: EmployeesService, useValue: {} }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(AlwaysTrueGuard)
      .overrideGuard(PermissionsGuard)
      .useValue(AlwaysTrueGuard)
      .compile();
    controller = module.get(EmployeesController);
  });

  function getPermissions(target: any, methodName: string): string[] {
    const handler = target[methodName];
    return reflector.get<string[]>(PERMISSIONS_KEY, handler) ?? [];
  }

  it('POST requires operational-person:create', () => {
    expect(getPermissions(controller, 'create')).toContain('operational-person:create');
  });

  it('GET / requires operational-person:read', () => {
    expect(getPermissions(controller, 'findAll')).toContain('operational-person:read');
  });

  it('GET /:id requires operational-person:read', () => {
    expect(getPermissions(controller, 'findOne')).toContain('operational-person:read');
  });

  it('PATCH /:id requires operational-person:update', () => {
    expect(getPermissions(controller, 'update')).toContain('operational-person:update');
  });

  it('POST /:id/deactivate requires operational-person:deactivate', () => {
    expect(getPermissions(controller, 'deactivate')).toContain('operational-person:deactivate');
  });

  it('POST /:id/activate requires operational-person:deactivate', () => {
    expect(getPermissions(controller, 'activate')).toContain('operational-person:deactivate');
  });

  it('DELETE /:id requires operational-person:delete', () => {
    expect(getPermissions(controller, 'remove')).toContain('operational-person:delete');
  });

  it('all CRUD permissions are distinct', () => {
    const all = [
      ...getPermissions(controller, 'create'),
      ...getPermissions(controller, 'findAll'),
      ...getPermissions(controller, 'update'),
      ...getPermissions(controller, 'remove'),
    ];
    const unique = [...new Set(all)];
    expect(unique).toEqual(expect.arrayContaining([
      'operational-person:create',
      'operational-person:read',
      'operational-person:update',
      'operational-person:delete',
    ]));
    expect(unique.length).toBe(4);
  });
});
