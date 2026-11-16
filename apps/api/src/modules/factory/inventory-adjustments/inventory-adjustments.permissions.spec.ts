import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { CanActivate } from '@nestjs/common';
import { InventoryAdjustmentsController } from './inventory-adjustments.controller';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { InventoryLockGuard } from '../../../common/guards/inventory-lock.guard';

const PERMISSIONS_KEY = 'permissions';
const AlwaysTrueGuard: CanActivate = { canActivate: () => true };

describe('InventoryAdjustmentsController read permission', () => {
  let reflector: Reflector;
  let controller: InventoryAdjustmentsController;

  beforeEach(async () => {
    reflector = new Reflector();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryAdjustmentsController],
      providers: [{ provide: InventoryAdjustmentsService, useValue: {} }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(AlwaysTrueGuard)
      .overrideGuard(PermissionsGuard)
      .useValue(AlwaysTrueGuard)
      .overrideGuard(InventoryLockGuard)
      .useValue(AlwaysTrueGuard)
      .compile();
    controller = module.get(InventoryAdjustmentsController);
  });

  function getPermissions(target: any, methodName: string): string[] {
    const handler = target[methodName];
    return reflector.get<string[]>(PERMISSIONS_KEY, handler) ?? [];
  }

  it('IAR-P10: GET /:id still requires inventory-adjustment:read and no print permission', () => {
    const permissions = getPermissions(controller, 'findOne');

    expect(permissions).toContain('inventory-adjustment:read');
    expect(permissions.some((permission) => permission.includes('print'))).toBe(false);
    expect(permissions.some((permission) => permission.includes('document'))).toBe(false);
  });
});
