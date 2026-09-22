import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator';
import { OverheadAllocationController } from './overhead-allocation.controller';
import { AllocationActionDto, AllocationNotesDto, AllocationPageDto, CreateOverheadAllocationDto } from './overhead-allocation.dto';
import { OVERHEAD_ALLOCATION_PERMISSIONS, OVERHEAD_ALLOCATION_PERMISSION_KEYS as P } from '../../../../prisma/seed/seed-overhead-allocation-permission-keys';

describe('B2 request authority and real permission guard', () => {
  const handlers = Object.getOwnPropertyNames(OverheadAllocationController.prototype).filter(n => n !== 'constructor');
  it('protects every actual handler with one separate B2/B3 permission', () => {
    expect(handlers).toHaveLength(13);
    expect(new Set(OVERHEAD_ALLOCATION_PERMISSIONS.map(p => p.key)).size).toBe(7);
    for (const name of handlers) {
      const keys = Reflect.getMetadata(PERMISSIONS_KEY, (OverheadAllocationController.prototype as any)[name]);
      expect(keys).toHaveLength(1); expect(Object.values(P)).toContain(keys[0]);
    }
  });
  it.each(handlers)('allows/denies %s through the real PermissionsGuard', async name => {
    const handler = (OverheadAllocationController.prototype as any)[name];
    const key = Reflect.getMetadata(PERMISSIONS_KEY, handler)[0];
    const db: any = { userRole: { findMany: jest.fn().mockResolvedValue([]) } };
    const guard = new PermissionsGuard(new Reflector(), db);
    const context: any = { getHandler: () => handler, getClass: () => OverheadAllocationController, switchToHttp: () => ({ getRequest: () => ({ user: { id: 'operator' } }) }) };
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    db.userRole.findMany.mockResolvedValue([{ role: { status: 'ACTIVE', code: 'B2_OPERATOR', permissions: [{ permission: { key, status: 'ACTIVE' } }] } }]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    db.userRole.findMany.mockResolvedValue([{ role: { status: 'ACTIVE', code: 'B2_OPERATOR', permissions: [{ permission: { key, status: 'INACTIVE' } }] } }]);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each(['companyId','branchId','companyKey','currencyCode','driverType','targets','sourceAmount','allocatedAmount','status','version'])('rejects forged create authority %s', async key => {
    const dto = plainToInstance(CreateOverheadAllocationDto, { periodId: 'period', clientRequestId: 'request', [key]: 'forged' });
    expect((await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).some(e => e.property === key && e.constraints?.whitelistValidation)).toBe(true);
  });
  it('updates notes only, never finalized amount/status/period', async () => {
    for (const key of ['periodId','allocatedAmount','status']) {
      expect((await validate(plainToInstance(AllocationNotesDto, { notes: 'edit', [key]: 'forged' }), { whitelist: true, forbidNonWhitelisted: true })).length).toBeGreaterThan(0);
    }
  });
  it('action bodies do not accept monetary overrides', async () => {
    expect((await validate(plainToInstance(AllocationActionDto, { amount: '1' }), { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: false })).length).toBeGreaterThan(0);
  });
  it.each([0,101,1.5])('rejects invalid page size %s', async limit => expect((await validate(plainToInstance(AllocationPageDto, { limit }))).length).toBeGreaterThan(0));
  it('rejects over-bound IDs', async () => expect((await validate(plainToInstance(CreateOverheadAllocationDto, { periodId: 'p'.repeat(201), clientRequestId: 'r' }))).length).toBeGreaterThan(0));
});
